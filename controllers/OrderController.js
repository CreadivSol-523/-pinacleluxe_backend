import ProductModel from "../models/ProductSchema.js";
import OrderModel from "../models/OrderSchema.js";
import GeolocationService from "../services/GeolocationService.js";
import PaymentProviderService from "../services/PaymentProviderService.js";
import mongoose from "mongoose";

// Create Order with Atomic Inventory Stock Reservation (Race Condition Prevention)
const idOf = (v) => (v && v._id ? v._id : v)?.toString();

/**
 * Product + (material, region) se sahi unit price nikalta hai.
 * - Variable product: material ke variant ki price[] list
 * - Simple product: product.pricing[] list
 * Region match na ho to error (pehle index par silently fallback NAHI karta).
 */
const resolveUnitPrice = (product, { material, regionId }) => {
   let priceList;

   if (product.isVariable) {
      const variant = product.variants?.find((v) => v.material === material);
      if (!variant) {
         throw new Error(`Material "${material || ""}" is not available for ${product.name}`);
      }
      priceList = variant.price;
   } else {
      priceList = product.pricing;
   }

   const entry = priceList?.find((p) => idOf(p.region) === String(regionId));
   if (!entry) {
      throw new Error(`${product.name} is not available for the selected region`);
   }

   const base = Number(entry.price) || 0;
   const discount = Number(entry.discountValue) || 0;

   // ASSUMPTION: "static" = fixed amount off, "percentage" = % off. Apne schema ke hisaab se check karo.
   const unitPrice = entry.discountMode === "percentage" ? base - (base * discount) / 100 : base - discount;

   return {
      unitPrice: Math.max(0, unitPrice),
      regionId: idOf(entry.region),
      currency: entry.region?.currency || null, // populate ki wajah se milti hai
   };
};

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
      let orderRegionId = null;
      let orderCurrency = null;
      const verifiedOrderItems = [];

      for (const item of orderItems) {
         const requestedQty = Number(item.quantity);
         if (!requestedQty || requestedQty <= 0) {
            throw new Error(`Invalid quantity for product ID: ${item.product}`);
         }

         const regionId = item.region || item.regionId;
         if (!regionId) {
            throw new Error(`Region is required for item: ${item.name || item.product}`);
         }

         // Atomic stock check + decrement
         const updatedProduct = await ProductModel.findOneAndUpdate(
            {
               _id: item.product,
               stock: { $gte: requestedQty },
            },
            {
               $inc: { stock: -requestedQty },
            },
            {
               new: true,
               session,
            },
         ).populate([
            { path: "variants.price.region", select: "currency" },
            { path: "pricing.region", select: "currency" },
         ]);

         if (!updatedProduct) {
            throw new Error(`Product out of stock or insufficient quantity available for item: ${item.name || item.product}`);
         }

         // Price HAMESHA server par material + region se nikalo (client ka price ignore)
         const {
            unitPrice,
            regionId: resolvedRegionId,
            currency,
         } = resolveUnitPrice(updatedProduct, {
            material: item.material,
            regionId,
         });

         // Poore order ka ek hi region/currency hona chahiye
         if (orderRegionId && orderRegionId !== resolvedRegionId) {
            throw new Error("All items in one order must be from the same region.");
         }
         orderRegionId = resolvedRegionId;
         orderCurrency = currency;

         itemsPrice += unitPrice * requestedQty;

         verifiedOrderItems.push({
            product: updatedProduct._id,
            name: updatedProduct.name,
            material: updatedProduct.isVariable ? item.material : "",
            colorVariants: item.colorVariants || "",
            price: unitPrice,
            quantity: requestedQty,
            image: updatedProduct.images?.[0] || item.image || "",
         });
      }

      const taxPrice = 0; // or calculated tax
      const safeShippingPrice = Number(shippingPrice) || 0; // TODO: shipping bhi server par calculate karo
      const totalPrice = itemsPrice + safeShippingPrice + taxPrice;

      // Automatically detect customer location & assign payment gateway
      const detection = await GeolocationService.detectCountry(req);
      const detectedCountry = detection.countryCode !== "UNKNOWN" ? detection.countryCode : customerDetails.country || "PK";

      const selectedGateway = paymentMethod === "COD" ? "COD" : PaymentProviderService.resolveProvider(detectedCountry);

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
               currency: orderCurrency, // schema mein add karna zaroori hai
               region: orderRegionId, // schema mein add karna zaroori hai
               paymentMethod: paymentMethod || "COD",
               paymentGateway: selectedGateway,
               detectedCountry,
               paymentStatus: "Pending",
               orderStatus: "Pending",
            },
         ],
         { session },
      );

      await session.commitTransaction();

      res.status(201).json({
         success: true,
         message: "Order placed successfully and inventory updated atomically.",
         order: order[0],
      });
   } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      res.status(400).json({
         success: false,
         message: error.message || "Failed to place order due to concurrency or stock issues.",
      });
   } finally {
      session.endSession();
   }
};
// Get all orders (Admin or User)
export const getOrders = async (req, res, next) => {
   try {
      const { page = 1, limit = 10, status, paymentStatus, search, date } = req.query;
      const query = {};

      if (status) query.orderStatus = status;
      if (paymentStatus) query.paymentStatus = paymentStatus;

      // Search: customer name / email / phone ya order number (_id ke last 6 chars)
      if (search && search.trim()) {
         const term = search.trim().replace(/^#/, "");
         const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // regex escape
         query.$or = [
            { "customerDetails.fullName": { $regex: safe, $options: "i" } },
            { "customerDetails.email": { $regex: safe, $options: "i" } },
            { "customerDetails.phone": { $regex: safe, $options: "i" } },
            // frontend ka "#E34B83" order number _id ke end se banta hai
            { $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: `${safe}$`, options: "i" } } },
         ];
      }

      // Date filter (YYYY-MM-DD), Pakistan time (UTC+5) ke hisaab se poora din
      if (date) {
         const start = new Date(`${date}T00:00:00+05:00`);
         if (!isNaN(start.getTime())) {
            const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: start, $lt: end };
         }
      }

      const pageNum = Math.max(Number(page) || 1, 1);
      const limitNum = Math.max(Number(limit) || 10, 1);
      const skip = (pageNum - 1) * limitNum;

      const [orders, total] = await Promise.all([OrderModel.find(query).populate("orderItems.product", "name sku").skip(skip).limit(limitNum).sort({ createdAt: -1 }), OrderModel.countDocuments(query)]);

      res.status(200).json({
         success: true,
         total,
         page: pageNum,
         pages: Math.ceil(total / limitNum),
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
