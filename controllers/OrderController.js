import ProductModel from "../models/ProductSchema.js";
import OrderModel from "../models/OrderSchema.js";
import GeolocationService from "../services/GeolocationService.js";
import PaymentProviderService from "../services/PaymentProviderService.js";
import mongoose from "mongoose";

// Create Order with Atomic Inventory Stock Reservation (Race Condition Prevention)
export const createOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { customerDetails, orderItems, paymentMethod, shippingPrice = 0 } = req.body;

        if (!customerDetails || !orderItems || orderItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid order data. Customer details and items are required.",
            });
        }

        let itemsPrice = 0;
        const verifiedOrderItems = [];

        // 1. Validate items and handle atomic stock deduction with race condition protection
        for (const item of orderItems) {
            const requestedQty = Number(item.quantity);
            if (!requestedQty || requestedQty <= 0) {
                throw new Error(`Invalid quantity for product ID: ${item.product}`);
            }

            // ATOMIC STOCK CHECK & DECREMENT using findOneAndUpdate to prevent race conditions
            // This guarantees that even under high concurrent checkout requests, stock cannot drop below 0.
            const updatedProduct = await ProductModel.findOneAndUpdate(
                {
                    _id: item.product,
                    stock: { $gte: requestedQty }, // Ensure sufficient stock exists atomically
                },
                {
                    $inc: { stock: -requestedQty }, // Atomically decrement stock
                },
                {
                    new: true,
                    session,
                }
            );

            if (!updatedProduct) {
                // Rollback happens automatically via session abort
                throw new Error(`Product out of stock or insufficient quantity available for item: ${item.name || item.product}`);
            }

            // Determine unit price: product.price, or regional pricing, or first variant price, or client-provided item.price
            let unitPrice = Number(updatedProduct.price);
            if (isNaN(unitPrice) || unitPrice === undefined || unitPrice === null) {
                if (updatedProduct.pricing && updatedProduct.pricing.length > 0 && typeof updatedProduct.pricing[0]?.price === "number") {
                    unitPrice = Number(updatedProduct.pricing[0].price);
                } else if (updatedProduct.variants && updatedProduct.variants.length > 0 && updatedProduct.variants[0]?.price?.length > 0 && typeof updatedProduct.variants[0].price[0]?.price === "number") {
                    unitPrice = Number(updatedProduct.variants[0].price[0].price);
                } else if (typeof item.price === "number" && !isNaN(item.price)) {
                    unitPrice = Number(item.price);
                } else {
                    unitPrice = 0;
                }
            }

            const itemTotal = unitPrice * requestedQty;
            itemsPrice += itemTotal;

            verifiedOrderItems.push({
                product: updatedProduct._id,
                name: updatedProduct.name,
                price: unitPrice,
                quantity: requestedQty,
                image: updatedProduct.images?.[0] || item.image || "",
            });
        }

        const taxPrice = 0; // or calculated tax
        const safeShippingPrice = Number(shippingPrice) || 0;
        const totalPrice = itemsPrice + safeShippingPrice + taxPrice;

        // Automatically detect customer location & assign payment gateway
        const detection = await GeolocationService.detectCountry(req);
        const detectedCountry = detection.countryCode !== "UNKNOWN"
            ? detection.countryCode
            : (customerDetails.country || "PK");

        const selectedGateway = paymentMethod === "COD" ? "COD" : PaymentProviderService.resolveProvider(detectedCountry);

        // 2. Create Order
        const order = await OrderModel.create(
            [
                {
                    user: req.user?._id || null,
                    customerDetails,
                    orderItems: verifiedOrderItems,
                    itemsPrice: Number(itemsPrice) || 0,
                    taxPrice,
                    shippingPrice: safeShippingPrice,
                    totalPrice: Number(totalPrice) || 0,
                    paymentMethod: paymentMethod || "COD",
                    paymentGateway: selectedGateway,
                    detectedCountry,
                    paymentStatus: "Pending",
                    orderStatus: "Pending",
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: "Order placed successfully and inventory updated atomically.",
            order: order[0],
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({
            success: false,
            message: error.message || "Failed to place order due to concurrency or stock issues.",
        });
    }
};

// Get all orders (Admin or User)
export const getOrders = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const query = {};
        if (status) {
            query.orderStatus = status;
        }

        const skip = (Number(page) - 1) * Number(limit);
        const orders = await OrderModel.find(query)
            .populate("orderItems.product", "name sku")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await OrderModel.countDocuments(query);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            orders,
        });
    } catch (error) {
        next(error);
    }
};

// Get single order
export const getSingleOrder = async (req, res, next) => {
    try {
        const order = await OrderModel.findById(req.params.id).populate("orderItems.product", "name sku images");
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        res.status(200).json({ success: true, order });
    } catch (error) {
        next(error);
    }
};

// Update order status
export const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { orderStatus, paymentStatus } = req.body;

        const order = await OrderModel.findById(id);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // If order is cancelled, optionally restore stock
        if (orderStatus === "Cancelled" && order.orderStatus !== "Cancelled") {
            for (const item of order.orderItems) {
                await ProductModel.findByIdAndUpdate(item.product, {
                    $inc: { stock: item.quantity },
                });
            }
        }

        if (orderStatus) order.orderStatus = orderStatus;
        if (paymentStatus) order.paymentStatus = paymentStatus;

        await order.save();

        res.status(200).json({
            success: true,
            message: "Order status updated successfully",
            order,
        });
    } catch (error) {
        next(error);
    }
};
