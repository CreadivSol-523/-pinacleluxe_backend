import mongoose from "mongoose";
const { Schema } = mongoose;

const UserOtpVerification = new Schema(
  {
    identifier: {
      type: String,
      unique: true,
    },
    otp: {
      type: String,
    },
    otpExpire: {
      type: Date,
    },
  },
  { timestamps: true }
);

const OtpVerificationModel = mongoose.model("verifications", UserOtpVerification);

export default OtpVerificationModel;