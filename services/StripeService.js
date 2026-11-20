import Stripe from "stripe";

class StripeService {
    constructor() {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_mock_key", {
            apiVersion: "2023-10-16",
        });
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
