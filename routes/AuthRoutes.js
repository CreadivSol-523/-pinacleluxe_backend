import express from "express";
import {
    register,
    login,
    logout,
    refreshToken,
    forgetPassword,
    verifyOtp,
    changePassword,
    HandleGetProfile,
    HandleUpdateProfile,
    handleGetUser,
} from "../controllers/AuthController.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/logout", logout);
router.post("/forget-password", forgetPassword);
router.post("/verify-otp", verifyOtp);
router.post("/change-password", changePassword);
router.get("/profile/:id", HandleGetProfile);
router.patch("/update-profile/:id", HandleUpdateProfile);
router.get("/get-users", handleGetUser);

export default router;
