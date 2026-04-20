import mongoose from "mongoose";

const VariantColorSchema = new mongoose.Schema(
    {
        hex: { type: String, trim: true },
        images: [{ type: String, trim: true }],
    },
    { _id: false }
);

const VariantSchema = new mongoose.Schema(
    {
        material: { type: String, required: true, trim: true },
        price: { type: Number, required: true, min: 0 },
        colors: { type: [VariantColorSchema], default: [] },
    },
    { _id: false }
);

const ProductSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, index: true },
        slug: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
        },
        description: { type: String, trim: true },
        categories: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Category",
                },
            ],
            required: true,
            validate: {
                validator(v) {
                    return Array.isArray(v) && v.length > 0;
                },
                message: "At least one category is required",
            },
            index: true,
        },
        badge: { type: String, trim: true },
        isVariable: {
            type: Boolean,
            default: true,
        },
        basePrice: {
            type: Number,
            required: true,
            min: 0,
        },
        discountMode: {
            type: String,
            enum: {
                values: ["percentage", "static"],
                message: "{VALUE} is not a valid discount mode",
            },
        },
        discountValue: {
            type: Number,
            default: 0,
            min: 0,
        },
        images: {
            type: [{ type: String, trim: true }],
            default: [],
        },
        variants: {
            type: [VariantSchema],
            default: [],
        },
        stock: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

ProductSchema.index({ createdAt: -1 });

const ProductModel = mongoose.model("Product", ProductSchema);

export default ProductModel;
