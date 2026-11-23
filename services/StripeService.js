import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

class StripeService {
    constructor() {
        this._stripe = null;
    }

    get stripe() {
        if (!this._stripe) {
            const secretKey = process.env.STRIPE_SECRET_KEY;
            if (!secretKey) {
                console.error("⚠️ STRIPE_SECRET_KEY is missing in process.env");
            }
            this._stripe = new Stripe(secretKey || "sk_test_mock_key", {
                apiVersion: "2023-10-16",
            });
        }
        return this._stripe;
    }

    /**
     * Create Stripe Payment Intent for Stripe Elements
     */
    async createPaymentIntent({ orderId, orderNumber, amountInCents, customerEmail, currency = "usd" }) {
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: amountInCents,
            currency: currency.toLowerCase(),
            automatic_payment_methods: {
                enabled: true,
            },
            receipt_email: customerEmail,
            metadata: {
                orderId: orderId.toString(),
                orderNumber: orderNumber || orderId.toString(),
            },
        });

        return paymentIntent;
    }

    /**
     * Create Stripe Checkout Session
     */
    async createCheckoutSession({ orderId, orderNumber, lineItems, customerEmail, successUrl, cancelUrl }) {
        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: lineItems.map((item) => ({
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: item.name,
                        images: item.image ? [item.image] : [],
                    },
                    unit_amount: Math.round(item.price * 100), // cents
                },
                quantity: item.quantity,
            })),
            mode: "payment",
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            metadata: {
                orderId: orderId.toString(),
                orderNumber,
            },
        });

        return session;
    }

    /**
     * Construct webhook event from raw body
     */
    constructWebhookEvent(rawBody, sigHeader) {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock";
        return this.stripe.webhooks.constructEvent(rawBody, sigHeader, webhookSecret);
    }
}

export default new StripeService();
