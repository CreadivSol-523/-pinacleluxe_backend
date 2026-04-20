import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        image: String,
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            default: null,
            index: true,
        },
    },
    { timestamps: true }
);

const CategoryModel = mongoose.model("Category", CategorySchema);

export default CategoryModel;