import mongoose from "mongoose";
const { Schema } = mongoose;

const NewsUpdateSchema = new Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "admins",
    },
    thumbnail: {
      type: String,
      default: "",
    },
    video: {
      type: String,
      default: "",
    },
    content: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const NewsUpdateModel = mongoose.model("news_updates", NewsUpdateSchema);

export default NewsUpdateModel;
