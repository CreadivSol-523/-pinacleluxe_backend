import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

// Middlewares
import ErrorHandler from "./middlewares/ErrorHandler.js";
import ErrorLogger from "./middlewares/ErrorLogger.js";
import RateLimiter from "./middlewares/RateLimiter.js";
import SecurityHeaders from "./middlewares/HelmetMiddleware.js";

// DB Connection
import connectDB from "./config/DB.js";

// Routes
import AdminAuthRoute from "./routes/AdminAuthRoutes.js";
import CategoryRoutes from "./routes/CategoryRoutes.js";
import ProductRoutes from "./routes/ProductRoutes.js";
import OrderRoutes from "./routes/OrderRoutes.js";
import RegionRoutes from "./routes/RegionRoutes.js";
import WebsiteSectionRouter from "./routes/WebsiteSectionRouter.js";
import PaymentRoutes from "./routes/PaymentRoutes.js";
import { handleStripeWebhook } from "./controllers/PaymentController.js";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger.js";
import { allowedOrigins } from "./utils/AllowedOrigins.js";

// Cloudinary
import { v2 as cloudinary } from "cloudinary";
import fileUpload from "express-fileupload";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();
app.set("trust proxy", 1);
app.use(SecurityHeaders);

// === MongoDB Connection ===
connectDB();

// === Stripe Webhook Route (Requires raw body) ===
app.post("/api/payment/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

// === Global Middlewares ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
   cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["POST", "GET", "PATCH", "PUT", "DELETE"],
   }),
);

// === Cloudinary Configuration ===
cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_secret: process.env.CLOUDINARY_API_SECRET,
   api_key: process.env.CLOUDINARY_API_KEY,
});

app.use(
   fileUpload({
      useTempFiles: true,
      tempFileDir: "/tmp/",
   }),
);

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api/docs.json", (req, res) => res.json(swaggerSpec));

app.get("/", (req, res) => {
   res.status(200).json({ heath: "Ok" });
});

// === Rate Limiter
app.use(RateLimiter);

// === Logger Middleware for logging errors
app.use(ErrorLogger);
app.use(cookieParser());
// === Routes ===
app.use("/api/auth", AdminAuthRoute);
app.use("/api/category", CategoryRoutes);
app.use("/api/product", ProductRoutes);
app.use("/api/order", OrderRoutes);
app.use("/api/region", RegionRoutes);
app.use("/api/webSection", WebsiteSectionRouter);
app.use("/api/payment", PaymentRoutes);

// === Error Handler
app.use(ErrorHandler);

// === Server Start ===
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
   console.log(`🚀 Server running on http://localhost:${PORT}`);
});
