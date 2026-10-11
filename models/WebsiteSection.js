import mongoose from "mongoose";

const sectionSchema = new mongoose.Schema(
   {
      type: {
         type: String,
         enum: ["topbar", "salesbanner", "hero", "media", "carousel", "stories"],
         required: true,
         unique: true,
      },

      data: {
         type: mongoose.Schema.Types.Mixed,
         required: true,
         default: {},
      },
   },
   {
      timestamps: true,
   },
);

const WebsiteSection = mongoose.model("WebsiteSection", sectionSchema);

export default WebsiteSection;
