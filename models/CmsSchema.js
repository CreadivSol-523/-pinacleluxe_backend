import mongoose from "mongoose";

const CmsSchema = new mongoose.Schema(
    {
        sectionType: {
            type: String,
            required: true,
            enum: ["topbar", "salesbanner", "hero", "media"],
            unique: true,
            index: true,
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
    },
    { timestamps: true }
);

const CmsModel = mongoose.model("Cms", CmsSchema);

export default CmsModel;
