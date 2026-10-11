import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // optional if guest checkout
        customerDetails: {
            fullName: { type: String, required: true },
            email: { type: String, required: true },
            phone: { type: String, required: true },
            address: { type: String, required: true },
            city: { type: String, required: true },
            postalCode: { type: String, required: true },
            country: { type: String, required: true },
        },
        orderItems: [
            {
                product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
                name: { type: String, required: true },
                price: { type: Number, required: true },
                quantity: { type: Number, required: true, min: 1 },
                image: { type: String },
            },
        ],
        itemsPrice: { type: Number, required: true },
        taxPrice: { type: Number, required: defaultToZero => 0 },
        shippingPrice: { type: Number, required: true, default: 0 },
        totalPrice: { type: Number, required: true },
        paymentMethod: { type: String, required: true, default: "COD" },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Paid", "Failed"],
            default: "Pending",
        },
        orderStatus: {
            type: String,
            enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
            default: "Pending",
        },
    },
    { timestamps: true }
);

// Fix the typo in default function or object
OrderSchema.path("taxPrice").default(0);

const OrderModel = mongoose.model("Order", OrderSchema);

export default OrderModel;
