import express from "express";
import {
    initiatePayFastPayment,
    handlePayFastCallback,
    createStripeCheckoutSession,
    handleStripeWebhook,
} from "../controllers/PaymentController.js";

const router = express.Router();

// PayFast Routes (Pakistan)
router.post("/payfast/initiate", initiatePayFastPayment);
router.get("/payfast/callback", handlePayFastCallback);

// Stripe Routes (International)
router.post("/stripe/create-checkout-session", createStripeCheckoutSession);

// Note: Stripe webhook is mounted directly in index.js with raw body parser
// but we also export handleStripeWebhook for use there.

export default router;
