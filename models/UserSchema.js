import mongoose from "mongoose";
const { Schema } = mongoose;

const UserSchema = new Schema(
  {
    username: {
      type: String,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
    },
    country: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    password: String,
    role: {
      type: String,
      enum: ["User"],
      default: "User",
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

const UserModel = mongoose.model("users", UserSchema);

export default UserModel;