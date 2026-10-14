import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, index: true },
        description: { type: String },

        // Base / Default Price
        price: { type: Number, required: true, min: 0 },
        comparePrice: { type: Number, min: 0 },

        // Regional Pricing: maps region reference to its specific price
        pricing: [
            {
                region: { type: mongoose.Schema.Types.ObjectId, ref: "Region", required: true },
                price: { type: Number, required: true, min: 0 },
                comparePrice: { type: Number, min: 0 },
            }
        ],

        // Inventory Stock Management fields
        stock: { type: Number, required: true, min: 0, default: 0 },
        sku: { type: String, unique: true, sparse: true },
        lowStockThreshold: { type: Number, default: 5 },
        category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
        images: [{ type: String }],
        isActive: { type: Boolean, default: true, index: true },

        // Sub-products / Accessories relation
        accessories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    },
    { timestamps: true }
);

const ProductModel = mongoose.model("Product", ProductSchema);

export default ProductModel;
