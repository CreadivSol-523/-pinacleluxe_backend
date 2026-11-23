import express from "express";
import {
    initiatePayFastPayment,
    handlePayFastCallback,
    createStripeCheckoutSession,
    createStripePaymentIntent,
    confirmStripePayment,
    handleStripeWebhook,
    detectLocation,
    initializeUnifiedPayment,
} from "../controllers/PaymentController.js";

const router = express.Router();

// Geo IP location detection
router.get("/location", detectLocation);

// Centralized automatic payment provider initialization endpoint
router.post("/initialize", initializeUnifiedPayment);

// PayFast Routes (Pakistan)
router.post("/payfast/initiate", initiatePayFastPayment);
router.get("/payfast/callback", handlePayFastCallback);

// Stripe Routes (International - Elements & Sessions)
router.post("/stripe/create-payment-intent", createStripePaymentIntent);
router.post("/stripe/confirm-payment", confirmStripePayment);
router.post("/stripe/create-checkout-session", createStripeCheckoutSession);

// Note: Stripe webhook is mounted directly in index.js with raw body parser
// but we also export handleStripeWebhook for use there.

export default router;
