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
        category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
        categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
        images: [{ type: String }],
        thumbnail: [{ type: String }],
        isActive: { type: Boolean, default: true, index: true },

        // Product Badge / Tag (e.g. Featured, New, Bestseller)
        badge: { type: String },

        // Product Variants (Material, Color options)
        variants: [
            {
                material: { type: String },
                price: [
                    {
                        region: { type: mongoose.Schema.Types.ObjectId, ref: "Region" },
                        price: { type: Number },
                        discountMode: { type: String },
                        discountValue: { type: Number },
                    }
                ],
                colors: [
                    {
                        hex: {
                            code: { type: String },
                            colorName: { type: String }
                        },
                        images: [{ type: String }]
                    }
                ]
            }
        ],

        // Sub-products / Accessories relation
        accessories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    },
    { timestamps: true }
);

const ProductModel = mongoose.model("Product", ProductSchema);

export default ProductModel;
