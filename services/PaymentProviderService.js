import GeolocationService from "./GeolocationService.js";
import PayFastService from "./PayFastService.js";
import StripeService from "./StripeService.js";
import OrderModel from "../models/OrderSchema.js";

/**
 * Centralized Payment Provider Selection Service
 * Automatically assigns and initializes the correct payment gateway
 * (PayFast for Pakistan, Stripe for international).
 */
class PaymentProviderService {
    /**
     * Determines the payment gateway for an order or customer request
     * @param {string} countryCode - ISO 2-letter country code or country name
     * @returns {"PayFast" | "Stripe"}
     */
    static resolveProvider(countryCode) {
        if (!countryCode) return "PayFast"; // default safe fallback

        const normalized = countryCode.trim().toUpperCase();
        if (normalized === "PK" || normalized === "PAKISTAN") {
            return "PayFast";
        }
        return "Stripe";
    }

    /**
     * Centralized payment session/intent initializer
     * Validates order, detects/verifies location, calculates prices, and delegates to the appropriate provider.
     *
     * @param {Object} params
     * @param {string} params.orderId
     * @param {import('express').Request} params.req
     * @param {string} [params.userMobileNumber]
     * @returns {Promise<Object>}
     */
    static async initializePayment({ orderId, req, userMobileNumber }) {
        if (!orderId) {
            throw new Error("orderId is required");
        }

        const order = await OrderModel.findById(orderId);
        if (!order) {
            throw new Error("Order not found");
        }

        if (order.paymentStatus === "Paid") {
            throw new Error("Order is already paid");
        }

        // 1. Detect or verify user country from request IP / Cloudflare header
        const detection = await GeolocationService.detectCountry(req);

        // Store detected country if not already recorded
        const detectedCountry = detection.countryCode !== "UNKNOWN"
            ? detection.countryCode
            : (order.customerDetails?.country || "PK");

        // 2. Resolve Provider: PK -> PayFast, Other -> Stripe
        const resolvedGateway = this.resolveProvider(detectedCountry);

        // Update order with detected country & assigned provider
        order.paymentGateway = resolvedGateway;
        order.paymentMethod = "Online";
        order.detectedCountry = detectedCountry;
        await order.save();

        // 3. Delegate to provider
        if (resolvedGateway === "PayFast") {
            return await this._initializePayFast(order, userMobileNumber);
        } else {
            return await this._initializeStripe(order);
        }
    }

    /**
     * PayFast initialization
     */
    static async _initializePayFast(order, userMobileNumber) {
        const basketId = `ORD-${order._id.toString().slice(-8).toUpperCase()}`;
        const txnAmount = order.totalPrice;
        const currencyCode = "PKR";

        const accessToken = await PayFastService.getAccessToken(basketId, txnAmount, currencyCode);

        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

        const successUrl = `${backendUrl}/api/payment/payfast/callback?type=success`;
        const failureUrl = `${backendUrl}/api/payment/payfast/callback?type=failure`;
        const checkoutUrl = `${frontendUrl}/checkout`;

        const items = order.orderItems.map((item, idx) => ({
            sku: item.product?.toString() || `ITEM-${idx}`,
            name: item.name,
            price: item.price,
            qty: item.quantity,
        }));

        const orderDate = new Date(order.createdAt || Date.now())
            .toISOString()
            .replace("T", " ")
            .substring(0, 19);

        const { formPostURL, formFields } = PayFastService.buildFormData({
            token: accessToken,
            basketId,
            txnAmount,
            currencyCode,
            orderDate,
            customerEmail: order.customerDetails.email,
            customerMobile: userMobileNumber || order.customerDetails.phone,
            txnDesc: `PinacleLuxe Order #${order._id}`,
            successUrl,
            failureUrl,
            checkoutUrl,
            items,
        });

        return {
            success: true,
            provider: "PayFast",
            orderId: order._id,
            formPostURL,
            formFields,
        };
    }

    /**
     * Stripe initialization (PaymentIntent for Elements)
     */
    static async _initializeStripe(order) {
        const amountInCents = Math.round(Number(order.totalPrice || 0) * 100);

        if (amountInCents <= 0) {
            throw new Error("Invalid order total amount for Stripe");
        }

        const paymentIntent = await StripeService.createPaymentIntent({
            orderId: order._id.toString(),
            orderNumber: order._id.toString(),
            amountInCents,
            customerEmail: order.customerDetails?.email,
            currency: "usd",
        });

        order.gatewayTransactionId = paymentIntent.id;
        await order.save();

        return {
            success: true,
            provider: "Stripe",
            orderId: order._id,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        };
    }
}

export default PaymentProviderService;
