import PayFastService from "../services/PayFastService.js";
import StripeService from "../services/StripeService.js";
import OrderModel from "../models/OrderSchema.js";
import GeolocationService from "../services/GeolocationService.js";
import PaymentProviderService from "../services/PaymentProviderService.js";

/**
 * GET /api/payment/location
 * Detects visitor country from IP or request headers
 */
export const detectLocation = async (req, res) => {
    try {
        const detection = await GeolocationService.detectCountry(req);
        const isPakistan = detection.isPakistan;
        return res.status(200).json({
            success: true,
            countryCode: detection.countryCode,
            countryName: detection.countryName,
            isPakistan,
            recommendedGateway: isPakistan ? "payfast" : "stripe",
            detectionMethod: detection.detectionMethod,
        });
    } catch (error) {
        return res.status(200).json({
            success: true,
            countryCode: "PK",
            countryName: "Pakistan",
            isPakistan: true,
            recommendedGateway: "payfast",
            detectionMethod: "error_fallback",
        });
    }
};

/**
 * POST /api/payment/initialize
 * Unified backend payment provider selection & session initializer.
 * Automatically selects PayFast for PK, Stripe for all other countries.
 */
export const initializeUnifiedPayment = async (req, res, next) => {
    try {
        const { orderId, userMobileNumber } = req.body;
        const result = await PaymentProviderService.initializePayment({
            orderId,
            req,
            userMobileNumber,
        });

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/payment/payfast/initiate
 *
 * Expects an existing orderId in the body.
 * Returns the PayFast form post URL + all hidden fields so the frontend
 * can build a <form> and submit it (redirect the user to PayFast).
 */
export const initiatePayFastPayment = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId is required" });
        }

        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.paymentStatus === "Paid") {
            return res.status(400).json({ success: false, message: "Order is already paid" });
        }

        const basketId = `ORD-${order._id.toString().slice(-8).toUpperCase()}`;
        const txnAmount = order.totalPrice;
        const currencyCode = "PKR";

        // 1. Get access token from PayFast
        const accessToken = await PayFastService.getAccessToken(basketId, txnAmount, currencyCode);

        // 2. Build callback URLs
        const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

        const successUrl = `${backendUrl}/api/payment/payfast/callback?type=success`;
        const failureUrl = `${backendUrl}/api/payment/payfast/callback?type=failure`;
        const checkoutUrl = `${frontendUrl}/checkout`;

        // 3. Build line items from order
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

        // 4. Build form data
        const { formPostURL, formFields } = PayFastService.buildFormData({
            token: accessToken,
            basketId,
            txnAmount,
            currencyCode,
            orderDate,
            customerEmail: order.customerDetails.email,
            customerMobile: order.customerDetails.phone,
            txnDesc: `PinacleLuxe Order #${order._id}`,
            successUrl,
            failureUrl,
            checkoutUrl,
            items,
        });

        // 5. Save gateway info on order
        order.paymentGateway = "PayFast";
        order.paymentMethod = "Online";
        await order.save();

        res.status(200).json({
            success: true,
            message: "PayFast payment initiated – redirect user to the form post URL",
            formPostURL,
            formFields,
            orderId: order._id,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/payment/payfast/callback
 *
 * PayFast redirects the user here after payment (success or failure).
 * We validate the hash, update the order, then redirect to the frontend.
 */
export const handlePayFastCallback = async (req, res, next) => {
    try {
        const result = PayFastService.validateCallback(req.query);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

        // basket_id was built as ORD-<last8chars of orderId>
        // We need to find the order. We stored the orderId in the basket_id format.
        // Find by looking up the order whose _id ends with the basket portion.
        const basketId = result.basketId;

        // Extract the last 8 chars (the mongo id suffix) from ORD-XXXXXXXX
        const idSuffix = basketId.replace("ORD-", "").toLowerCase();

        // Find the matching order
        const orders = await OrderModel.find({
            paymentGateway: "PayFast",
            paymentStatus: "Pending",
        }).sort({ createdAt: -1 });

        let order = null;
        for (const o of orders) {
            if (o._id.toString().slice(-8).toUpperCase() === idSuffix.toUpperCase()) {
                order = o;
                break;
            }
        }

        if (!order) {
            // Redirect to frontend with error
            return res.redirect(`${frontendUrl}/checkout?payment=error&message=Order+not+found`);
        }

        if (!result.valid) {
            order.paymentStatus = "Failed";
            await order.save();
            return res.redirect(
                `${frontendUrl}/checkout?payment=failed&message=Hash+validation+failed&orderId=${order._id}`
            );
        }

        if (result.isSuccess) {
            order.paymentStatus = "Paid";
            order.orderStatus = "Processing";
            order.gatewayTransactionId = result.transactionId;
            await order.save();
            return res.redirect(
                `${frontendUrl}/order-confirmation/${order._id}?payment=success`
            );
        } else {
            order.paymentStatus = "Failed";
            order.gatewayTransactionId = result.transactionId || "";
            await order.save();
            return res.redirect(
                `${frontendUrl}/checkout?payment=failed&message=${encodeURIComponent(result.errMsg)}&orderId=${order._id}`
            );
        }
    } catch (error) {
        console.error("PayFast callback error:", error);
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return res.redirect(`${frontendUrl}/checkout?payment=error&message=Internal+server+error`);
    }
};

// ─────────────────────────────────────────────
//  Stripe  (International – Elements & Payment Intent)
// ─────────────────────────────────────────────

/**
 * POST /api/payment/stripe/create-payment-intent
 *
 * Creates a Stripe PaymentIntent for embedded Stripe Elements.
 */
export const createStripePaymentIntent = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId is required" });
        }

        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.paymentStatus === "Paid") {
            return res.status(400).json({ success: false, message: "Order is already paid" });
        }

        // Amount in cents
        const amountInCents = Math.round(Number(order.totalPrice || 0) * 100);

        if (amountInCents <= 0) {
            return res.status(400).json({ success: false, message: "Invalid order amount" });
        }

        const paymentIntent = await StripeService.createPaymentIntent({
            orderId: order._id.toString(),
            orderNumber: order._id.toString(),
            amountInCents,
            customerEmail: order.customerDetails?.email,
            currency: "usd",
        });

        // Save gateway info
        order.paymentGateway = "Stripe";
        order.paymentMethod = "Online";
        order.gatewayTransactionId = paymentIntent.id;
        await order.save();

        res.status(200).json({
            success: true,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            orderId: order._id,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/payment/stripe/confirm-payment
 *
 * Client notifies backend after Stripe Elements confirms payment.
 */
export const confirmStripePayment = async (req, res, next) => {
    try {
        const { orderId, paymentIntentId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId is required" });
        }

        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        order.paymentStatus = "Paid";
        order.orderStatus = "Processing";
        if (paymentIntentId) {
            order.gatewayTransactionId = paymentIntentId;
        }
        await order.save();

        res.status(200).json({
            success: true,
            message: "Payment confirmed successfully",
            order,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
//  Stripe  (International – Checkout Session)
// ─────────────────────────────────────────────

/**
 * POST /api/payment/stripe/create-checkout-session
 *
 * Expects an existing orderId in the body.
 * Creates a Stripe Checkout Session and returns the session URL.
 */
export const createStripeCheckoutSession = async (req, res, next) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "orderId is required" });
        }

        const order = await OrderModel.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.paymentStatus === "Paid") {
            return res.status(400).json({ success: false, message: "Order is already paid" });
        }

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

        // Build line items (Stripe expects amounts in the smallest currency unit – cents)
        const lineItems = order.orderItems.map((item) => ({
            name: item.name,
            price: Math.round(item.price * 100), // dollars → cents
            quantity: item.quantity,
            image: item.image || undefined,
        }));

        const shippingCostCents = Math.round((order.shippingPrice || 0) * 100);

        const session = await StripeService.createCheckoutSession({
            orderId: order._id.toString(),
            lineItems,
            customerEmail: order.customerDetails.email,
            successUrl: `${frontendUrl}/order-confirmation/${order._id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${frontendUrl}/checkout?payment=cancelled&orderId=${order._id}`,
            currency: "usd",
            shippingCost: shippingCostCents,
        });

        // Save gateway info
        order.paymentGateway = "Stripe";
        order.paymentMethod = "Online";
        order.gatewayTransactionId = session.id;
        await order.save();

        res.status(200).json({
            success: true,
            message: "Stripe checkout session created",
            sessionUrl: session.url,
            sessionId: session.id,
            orderId: order._id,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/payment/stripe/webhook
 *
 * Stripe sends events here (payment completed, failed, etc.).
 * This route expects the raw body (not parsed JSON).
 */
export const handleStripeWebhook = async (req, res) => {
    let event;
    try {
        const signature = req.headers["stripe-signature"];
        event = StripeService.constructWebhookEvent(req.body, signature);
    } catch (error) {
        console.error("Stripe webhook signature verification failed:", error.message);
        return res.status(400).json({ success: false, message: `Webhook Error: ${error.message}` });
    }

    try {
        switch (event.type) {
            case "payment_intent.succeeded": {
                const paymentIntent = event.data.object;
                const orderId = paymentIntent.metadata?.orderId;

                if (orderId) {
                    const order = await OrderModel.findById(orderId);
                    if (order && order.paymentStatus !== "Paid") {
                        order.paymentStatus = "Paid";
                        order.orderStatus = "Processing";
                        order.gatewayTransactionId = paymentIntent.id;
                        await order.save();
                        console.log(`✅ Stripe Elements payment confirmed for order ${orderId}`);
                    }
                }
                break;
            }

            case "payment_intent.payment_failed": {
                const paymentIntent = event.data.object;
                const orderId = paymentIntent.metadata?.orderId;

                if (orderId) {
                    const order = await OrderModel.findById(orderId);
                    if (order && order.paymentStatus === "Pending") {
                        order.paymentStatus = "Failed";
                        await order.save();
                        console.log(`❌ Stripe PaymentIntent failed for order ${orderId}`);
                    }
                }
                break;
            }

            case "checkout.session.completed": {
                const session = event.data.object;
                const orderId = session.metadata?.orderId;

                if (orderId) {
                    const order = await OrderModel.findById(orderId);
                    if (order && order.paymentStatus !== "Paid") {
                        order.paymentStatus = "Paid";
                        order.orderStatus = "Processing";
                        order.gatewayTransactionId = session.id;
                        await order.save();
                        console.log(`✅ Stripe payment confirmed for order ${orderId}`);
                    }
                }
                break;
            }

            case "checkout.session.expired": {
                const session = event.data.object;
                const orderId = session.metadata?.orderId;

                if (orderId) {
                    const order = await OrderModel.findById(orderId);
                    if (order && order.paymentStatus === "Pending") {
                        order.paymentStatus = "Failed";
                        await order.save();
                        console.log(`❌ Stripe session expired for order ${orderId}`);
                    }
                }
                break;
            }

            default:
                // Unhandled event type — acknowledge receipt
                break;
        }

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Stripe webhook processing error:", error);
        res.status(500).json({ success: false, message: "Webhook processing error" });
    }
};
