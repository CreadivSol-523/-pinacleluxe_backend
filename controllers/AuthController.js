import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { generateAccessToken, generateRefreshToken, generateOTP } from "../utils/TokenGenerator.js";
import UserModel from "../models/UserSchema.js";
import autoMailer from "../utils/AutoMailer.js";
import mongoose from "mongoose";
import AdminModel from "../models/AdminSchema.js";
import ExtractRelativeFilePath from "../middlewares/ExtractRelativePath.js";
import OtpVerificationModel from "../models/UserOtpVerification.js";
import { v2 as cloudinary } from "cloudinary";
import SendGridMailer from "../utils/SendGridMailer.js";
import SearchQuery from "../utils/SearchQuery.js";

// REGISTER
// METHOD : POST
// ENDPOINT: /api/register
const register = async (req, res, next) => {
  try {
    const { username, email, phone, password, deviceId, role } = req.body;

    const findOtp = await OtpVerificationModel.findOne({ identifier: email });
    if (findOtp) {
      await OtpVerificationModel.findOneAndDelete({ identifier: email });
    }

    const existingUser =
      (await UserModel.findOne({
        email,
      })) ||
      (await AdminModel.findOne({
        email,
      }));
    if (existingUser) {
      return res.status(400).json({ message: "Username or email already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === "Admin") {
      const validateAdmin = await AdminModel.find();
      if (validateAdmin.length !== 0) {
        return res.status(400).json({ message: "There can only be one admin" });
      }
      const newUser = new AdminModel({
        username,
        email,
        phone,
        password: hashedPassword,
      });

      await newUser.save();

      // Generate tokens
      const accessToken = generateAccessToken(newUser);
      const refreshToken = generateRefreshToken(newUser, deviceId || "Web");
      newUser.refreshTokens.push({
        token: refreshToken,
        deviceId: deviceId || "Web",
      });
      await newUser.save();

      const userDetails = {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        _id: newUser._id,
      };

      // Return tokens
      return res.status(201).json({
        message: "User registered successfully",
        accessToken,
        refreshToken,
        user: userDetails,
      });
    } else if (role === "User") {
      const otp = generateOTP();
      const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // autoMailer({
      //   to: email,
      //   subject: "Password Reset OTP",
      //   message: `<p>Your OTP for password reset is: <b>${otp}</b>. It will expire in 10 minutes.</p>`,
      // });

      SendGridMailer({
        to: email,
        subject: "Email Verification OTP",
        html: `<p>Your OTP for email verification is: <b>${otp}</b>. It will expire in 10 minutes.</p>`,
      });

      const createUserOtp = new OtpVerificationModel({
        identifier: email,
        otp: otp,
        otpExpire: otpExpire,
      });

      await createUserOtp.save();

      res.status(201).json({
        message: "Otp sent to your email",
      });
    }
  } catch (err) {
    next(err);
  }
};

// LOGIN
// METHOD : POST
// ENDPOINT: /api/login
const login = async (req, res, next) => {
  try {
    const { identifier, password, deviceId } = req.body;

    const user =
      (await UserModel.findOne({
        email: identifier,
      })) ||
      (await AdminModel.findOne({
        email: identifier,
      }));

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = generateAccessToken(user, deviceId);
    const refreshToken = generateRefreshToken(user, deviceId);

    user.refreshTokens = user.refreshTokens.filter((entry) => entry.deviceId !== deviceId);

    user.refreshTokens.push({
      token: refreshToken,
      deviceId: deviceId,
    });
    await user.save();

    res.status(200).json({ accessToken, refreshToken, user: user });
  } catch (err) {
    next(err);
  }
};

// REFRESH
// METHOD : POST
// ENDPOINT: /api/refresh
const refreshToken = async (req, res) => {
  const { token, deviceId } = req.body;

  if (!token) {
    return res.status(403).json({ message: "Refresh token is required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const user = (await UserModel.findById(decoded.id)) || (await AdminModel.findById(decoded.id));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const matchToken = user.refreshTokens.find((entry) => entry.token === token);

    if (!matchToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const accessToken = generateAccessToken(user, deviceId);

    res.status(200).json({ accessToken });
  } catch (err) {
    res.status(403).json({ message: "Invalid refresh token" });
  }
};

// LOGOUT (Invalidate refresh token)
// METHOD : POST
// ENDPOINT: /api/logout
const logout = async (req, res) => {
  const { token, deviceId } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const user = (await UserModel.findById(decoded.id)) || (await AdminModel.findById(decoded.id));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Remove the matching refresh token by token and optionally deviceId
    user.refreshTokens = user.refreshTokens.filter((entry) => entry.token !== token && (!deviceId || entry.deviceId !== deviceId));

    await user.save();

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(403).json({ message: "Invalid refresh token" });
  }
};

// FORGET PASSWORD
// METHOD: POST
// ENDPOINT: /api/forget-password
const forgetPassword = async (req, res, next) => {
  try {
    const { identifier, type } = req.body;

    if (!type || type === "") {
      return res.status(400).json({ message: "Type Field is required" });
    }

    const otp = generateOTP();
    const otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (type === "signup") {
      const findOtp = await OtpVerificationModel.findOne({ identifier: identifier });
      if (findOtp) {
        await OtpVerificationModel.findOneAndDelete({ identifier: identifier });
      }
      const createUserOtp = new OtpVerificationModel({
        identifier: identifier,
        otp: otp,
        otpExpire: otpExpire,
      });
      await createUserOtp.save();

      SendGridMailer({
        to: identifier,
        subject: "Email Verification OTP",
        html: `<p>Your OTP for email verification is: <b>${otp}</b>. It will expire in 10 minutes.</p>`,
      });
      res.status(200).json({ message: "OTP sent to your email.", identifier });
    } else if (type === "otp") {
      const user =
        (await UserModel.findOne({
          email: identifier,
        })) ||
        (await AdminModel.findOne({
          email: identifier,
        }));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      user.otp = otp;
      user.otpExpire = otpExpire;
      await user.save();

      SendGridMailer({
        to: identifier,
        subject: "Password Reset OTP",
        html: `<p>Your OTP for password reset is: <b>${otp}</b>. It will expire in 10 minutes.</p>`,
      });

      res.status(200).json({ message: "OTP sent to your email.", identifier });
    }
  } catch (err) {
    next(err);
  }
};

// VERIFY OTP
// METHOD: POST
// ENDPOINT: /api/verify-otp
const verifyOtp = async (req, res, next) => {
  try {
    const { identifier, otp, type } = req.body;

    if (!type || type === "") {
      return res.status(400).json({ message: "Type Field is required" });
    }

    if (type === "signup") {
      const { username, email, phone, password, deviceId } = req.body;

      if (!username || !email || !phone || !password || !deviceId) {
        return res.status(400).json({ message: "Please fill all the required fields" });
      }

      if (username === "" || email === "" || phone === "" || password === "" || deviceId === "") {
        return res.status(400).json({ message: "Please fill all the required fields" });
      }

      const findOtp = await OtpVerificationModel.findOne({ identifier: identifier });
      if (!findOtp) {
        return res.status(404).json({ message: "Otp not found" });
      }
      if (!findOtp.otp || !findOtp.otpExpire) {
        return res.status(400).json({ message: "No OTP requested." });
      }
      if (findOtp.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP." });
      }
      if (findOtp.otpExpire < new Date()) {
        return res.status(400).json({ message: "OTP expired." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new UserModel({
        username,
        email,
        phone,
        password: hashedPassword,
        role: "User",
      });

      await newUser.save();

      // Generate tokens
      const accessToken = generateAccessToken(newUser);
      const refreshToken = generateRefreshToken(newUser, deviceId || "Web");
      newUser.refreshTokens.push({
        token: refreshToken,
        deviceId: deviceId || "Web",
      });
      await newUser.save();

      const userDetails = {
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        _id: newUser._id,
      };

      await OtpVerificationModel.findOneAndDelete({ identifier: identifier });

      return res.status(200).json({ accessToken, refreshToken, user: newUser });
    } else if (type === "otp") {
      const user =
        (await UserModel.findOne({
          email: identifier,
        })) ||
        (await AdminModel.findOne({
          email: identifier,
        }));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!user.otp || !user.otpExpire) {
        return res.status(400).json({ message: "No OTP requested." });
      }
      if (user.otp !== otp) {
        return res.status(400).json({ message: "Invalid OTP." });
      }
      if (user.otpExpire < new Date()) {
        return res.status(400).json({ message: "OTP expired." });
      }
      return res.status(200).json({ message: "OTP verified.", identifier, otp });
    } else {
      res.status(400).json({ message: "Invalid Request" });
    }
  } catch (err) {
    next(err);
  }
};

// CHANGE PASSWORD
// METHOD: POST
// ENDPOINT: /api/change-password
const changePassword = async (req, res, next) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    const user = await UserModel.findOne({
      email: identifier,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!user.otp || !user.otpExpire) {
      return res.status(400).json({ message: "No OTP requested." });
    }
    if (user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }
    if (user.otpExpire < new Date()) {
      return res.status(400).json({ message: "OTP expired." });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = null;
    user.otpExpire = null;
    await user.save();
    res.status(200).json({ message: "Password changed successfully." });
  } catch (err) {
    next(err);
  }
};

// GET PROFILE
// METHOD: GET
// ENDPOINT: /api/profile/:id
const HandleGetProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = (await UserModel.findById(id)) || (await AdminModel.findById(id));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ profile: user });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// UPDATE PROFILE
// METHOD: PATCH
// ENDPOINT: /api/update-profile/:id
const HandleUpdateProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    let user = await UserModel.findById(id);
    let model = UserModel;

    if (!user) {
      user = await AdminModel.findById(id);
      model = AdminModel;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { oldPassword, newPassword } = req.body;

    const profilePicture = req?.files?.profilePicture;
    const uploadResult = profilePicture
      ? await cloudinary.uploader.upload(profilePicture.tempFilePath, {
        resource_type: "image",
        folder: `profiles`,
      })
      : "";

    const updatedFields = {};

    const { country, city, username, phone } = req.body;

    if (profilePicture) {
      updatedFields.profilePicture = uploadResult.secure_url;
    }
    if (country) {
      updatedFields.country = country;
    }
    if (city) {
      updatedFields.city = city;
    }
    if (username) {
      updatedFields.username = username;
    }
    if (phone) {
      updatedFields.phone = phone;
    }

    if (oldPassword && !newPassword) {
      return res.status(400).json({ message: "new password is required when you enter old password" });
    }

    if (oldPassword && newPassword) {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Old password is incorrect" });
      }
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      updatedFields.password = hashedNewPassword;
    }

    await model.updateOne({ _id: id }, { $set: updatedFields });

    const updatedUser = await model.findById(id);

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// GET USERS
// METHOD: GET
// ENDPOINT: /api/get-users
const handleGetUser = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || {};

    const matchStage = SearchQuery(search);
    const pipeline = [];

    if (matchStage) pipeline.push(matchStage);

    pipeline.push({
      $project: {
        _id: 1,
        username: 1,
        phone: 1,
        email: 1,
        country: 1,
        city: 1,
        createdAt: 1,
      },
    });

    pipeline.push({ $sort: { createdAt: -1 } });


    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const users = await UserModel.aggregate(pipeline);

    const countPipeline = [];
    if (matchStage) countPipeline.push(matchStage);
    countPipeline.push({ $count: "totalItems" });

    const countResult = await UserModel.aggregate(countPipeline);
    const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
    const totalPages = Math.ceil(totalItems / limit);

    res.status(200).json({
      users,
      meta: {
        totalItems,
        totalPages,
        page,
        limit,
      },
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

export { register, login, logout, refreshToken, forgetPassword, verifyOtp, changePassword, HandleGetProfile, HandleUpdateProfile, handleGetUser };
