import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import AdminModel from "../models/AdminSchema.js";

// ── Config (.env se) ──────────────────────────────────────────────────────────
// Lazy read: dotenv.config() server.js me import hoisting ke baad bhi chale to bhi theek rahe

// "15m" / "7d" / "30s" / "2h" => milliseconds
const parseDuration = (value, fallback) => {
   const match = /^(\d+)([smhd])$/.exec(String(value ?? "").trim());
   if (!match) return fallback;
   const unit = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 }[match[2]];
   return Number(match[1]) * unit;
};

const toPositiveInt = (value, fallback) => {
   const n = parseInt(value, 10);
   return Number.isInteger(n) && n > 0 ? n : fallback;
};

const getConfig = () => {
   const accessSecret = process.env.JWT_ACCESS_SECRET;
   const refreshSecret = process.env.JWT_REFRESH_SECRET;

   if (!accessSecret || !refreshSecret) {
      throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in .env");
   }

   // Invalid format ho to default 15m / 7d
   const accessTtl = parseDuration(process.env.JWT_EXPIRES_IN, null) ? process.env.JWT_EXPIRES_IN.trim() : "15m";
   const refreshTtl = parseDuration(process.env.JWT_REFRESH_EXPIRES_IN, null) ? process.env.JWT_REFRESH_EXPIRES_IN.trim() : "7d";

   return {
      accessSecret,
      refreshSecret,
      accessTtl,
      refreshTtl,
      accessMaxAge: parseDuration(accessTtl, 15 * 60 * 1000),
      refreshMaxAge: parseDuration(refreshTtl, 7 * 24 * 60 * 60 * 1000),
      bcryptRounds: toPositiveInt(process.env.BCRYPT_ROUNDS, 12),
      maxDevices: toPositiveInt(process.env.MAX_DEVICES, 5), // ek admin ke max active devices
      signupKey: process.env.ADMIN_SIGNUP_KEY || "",
      isProd: process.env.NODE_ENV === "production",
      sameSite: process.env.COOKIE_SAMESITE || "lax", // cross-site frontend ho to "none" (secure required)
   };
};

const cookieOptions = (cfg, maxAge) => ({
   httpOnly: true,
   secure: cfg.isProd,
   sameSite: cfg.sameSite,
   maxAge,
   path: "/",
   ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

// Login me user na mile tab bhi bcrypt chalao taake timing se pata na chale ke email exist karta hai
let dummyHash;
const getDummyHash = (rounds) => {
   if (!dummyHash) dummyHash = bcrypt.hashSync("dummy-password-for-timing", rounds);
   return dummyHash;
};

// ── Sanitizers ────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

// NoSQL injection se bachne ke liye: sirf string allow ({ "$gt": "" } jaise objects reject)
const asString = (v) => (typeof v === "string" ? v : "");

const sanitizeEmail = (v) =>
   asString(v)
      .replace(CONTROL_CHARS, "")
      .replace(/[\s<>"'`\\;(),:[\]]/g, "")
      .toLowerCase()
      .slice(0, 254);

const sanitizeUsername = (v) => asString(v).replace(CONTROL_CHARS, "").trim().toLowerCase().slice(0, 30);

const sanitizePhone = (v) =>
   asString(v)
      .replace(CONTROL_CHARS, "")
      .replace(/[\s\-().]/g, "")
      .slice(0, 16);

const sanitizePassword = (v) => asString(v).replace(CONTROL_CHARS, "").slice(0, 64);

const sanitizeDeviceId = (v) => {
   const clean = asString(v)
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 64);
   return clean || crypto.randomUUID();
};

// ── Validators ────────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const USERNAME_REGEX = /^[a-z0-9._]{3,30}$/;
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

const validateSignup = ({ username, phone, email, password }) => {
   const errors = {};
   if (!USERNAME_REGEX.test(username)) errors.username = "Username must be 3-30 characters (letters, numbers, . or _)";
   if (!PHONE_REGEX.test(phone)) errors.phone = "Enter a valid phone number (10-15 digits)";
   if (!EMAIL_REGEX.test(email)) errors.email = "Enter a valid email address";
   if (password.length < 8 || password.length > 64) errors.password = "Password must be 8-64 characters";
   else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) errors.password = "Password must include uppercase, lowercase and a number";
   else if (/^\s|\s$/.test(password)) errors.password = "Password cannot start or end with a space";
   return errors;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// Constant-time compare (signup key ke liye)
const safeEqual = (a, b) => {
   const ha = crypto.createHash("sha256").update(String(a)).digest();
   const hb = crypto.createHash("sha256").update(String(b)).digest();
   return crypto.timingSafeEqual(ha, hb);
};

const signAccessToken = (cfg, admin) => jwt.sign({ id: admin._id, role: admin.role }, cfg.accessSecret, { expiresIn: cfg.accessTtl });

const signRefreshToken = (cfg, admin, deviceId) => jwt.sign({ id: admin._id, deviceId }, cfg.refreshSecret, { expiresIn: cfg.refreshTtl });

// Response me sensitive fields kabhi nahi jayengi
const toPublicAdmin = (admin) => ({
   _id: admin._id,
   username: admin.username,
   email: admin.email,
   phone: admin.phone,
   role: admin.role,
   profilePicture: admin.profilePicture,
   createdAt: admin.createdAt,
});

// ── Signup ────────────────────────────────────────────────────────────────────
// POST /api/admin/signup
// Header: x-admin-signup-key: <ADMIN_SIGNUP_KEY>
export const adminSignup = async (req, res, next) => {
   try {
      const cfg = getConfig();
      console.log(process.env.ADMIN_SIGNUP_KEY);
      // Admin banana protected hai, warna koi bhi admin ban jayega
      const providedKey = asString(req.headers["x-admin-signup-key"]);
      if (!cfg.signupKey || !providedKey || !safeEqual(providedKey, cfg.signupKey)) {
         return res.status(403).json({ success: false, message: "Not allowed to create an admin account" });
      }

      const data = {
         username: sanitizeUsername(req.body?.username),
         phone: sanitizePhone(req.body?.phone),
         email: sanitizeEmail(req.body?.email),
         password: sanitizePassword(req.body?.password),
      };

      const errors = validateSignup(data);
      if (Object.keys(errors).length > 0) {
         return res.status(400).json({ success: false, message: "Validation failed", errors });
      }

      const exists = await AdminModel.exists({ $or: [{ email: data.email }, { username: data.username }] });
      if (exists) {
         return res.status(409).json({ success: false, message: "Email or username already in use" });
      }

      const hashedPassword = await bcrypt.hash(data.password, cfg.bcryptRounds);

      const admin = await AdminModel.create({
         username: data.username,
         phone: data.phone,
         email: data.email,
         password: hashedPassword,
      });

      return res.status(201).json({
         success: true,
         message: "Admin account created successfully",
         admin: toPublicAdmin(admin),
      });
   } catch (error) {
      // Race condition: unique index duplicate
      if (error?.code === 11000) {
         return res.status(409).json({ success: false, message: "Email or username already in use" });
      }
      next(error);
   }
};

// ── Login ─────────────────────────────────────────────────────────────────────
// POST /api/admin/login   body: { email, password, deviceId? }
export const adminLogin = async (req, res, next) => {
   try {
      const cfg = getConfig();

      const email = sanitizeEmail(req.body?.email);
      const password = sanitizePassword(req.body?.password);
      const deviceId = sanitizeDeviceId(req.body?.deviceId);

      if (!EMAIL_REGEX.test(email) || password.length < 8) {
         return res.status(400).json({ success: false, message: "Valid email and password are required" });
      }

      const admin = await AdminModel.findOne({ email });

      const passwordMatches = await bcrypt.compare(password, admin?.password || getDummyHash(cfg.bcryptRounds));

      // Generic message: email galat hai ya password, pata nahi chalna chahiye
      if (!admin || !passwordMatches) {
         return res.status(401).json({ success: false, message: "Invalid email or password" });
      }

      const accessToken = signAccessToken(cfg, admin);
      const refreshToken = signRefreshToken(cfg, admin, deviceId);

      // Refresh token hash karke store (DB leak ho to bhi token use nahi hoga)
      // Same device ka purana token replace, aur max cfg.maxDevices rakho
      const otherDevices = (admin.refreshTokens || []).filter((t) => t.deviceId !== deviceId);
      admin.refreshTokens = [...otherDevices, { token: sha256(refreshToken), deviceId }].slice(-cfg.maxDevices);
      await admin.save();

      res.cookie("accessToken", accessToken, cookieOptions(cfg, cfg.accessMaxAge));
      res.cookie("refreshToken", refreshToken, cookieOptions(cfg, cfg.refreshMaxAge));

      return res.status(200).json({
         success: true,
         message: "Login successful",
         deviceId, // frontend isay save kare aur next login par bheje
         admin: toPublicAdmin(admin),
      });
   } catch (error) {
      next(error);
   }
};

// ── Logout ────────────────────────────────────────────────────────────────────
// POST /api/admin/logout
export const adminLogout = async (req, res, next) => {
   try {
      const cfg = getConfig();
      const refreshToken = req.cookies?.refreshToken;

      // Is device ka refresh token DB se hata do
      if (refreshToken) {
         try {
            const decoded = jwt.verify(refreshToken, cfg.refreshSecret);
            await AdminModel.updateOne({ _id: decoded.id }, { $pull: { refreshTokens: { token: sha256(refreshToken) } } });
         } catch {
            // token expire ya kharab ho to bhi cookies saaf karni hain
         }
      }

      // clearCookie ke options wahi hone chahiye jo set karte waqt the (maxAge ke baghair)
      const { maxAge, ...opts } = cookieOptions(cfg, 0);
      res.clearCookie("accessToken", opts);
      res.clearCookie("refreshToken", opts);

      return res.status(200).json({ success: true, message: "Logged out successfully" });
   } catch (error) {
      next(error);
   }
};
