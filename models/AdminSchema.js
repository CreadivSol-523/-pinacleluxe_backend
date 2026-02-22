import mongoose from "mongoose";
const { Schema } = mongoose;

const AdminSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
    },
    password: String,
    role: {
      type: String,
      enum: ["Admin"],
      default: "Admin",
    },
    refreshTokens: {
      type: [
        {
          token: { type: String },
          deviceId: { type: String },
        },
      ],
      default: [],
    },
    deviceId: {
      type: String
    },
    otp: {
      type: String,
    },
    otpExpire: {
      type: Date,
    },
    profilePicture: {
      type: String,
      default: "https://res.cloudinary.com/djnsp1p8r/image/upload/v1754084452/placeholder-profile_girwxh.png"
    }
  },
  { timestamps: true }
);

const AdminModel = mongoose.model("admins", AdminSchema);

export default AdminModel;