import express from "express";
import {
    initiatePayFastPayment,
    confirmPayFastPayment,
    getPayFastBanks
} from "../controllers/PaymentController.js";

const router = express.Router();

router.post("/payfast/initiate", initiatePayFastPayment);
router.post("/payfast/confirm", confirmPayFastPayment);
router.get("/payfast/banks", getPayFastBanks);

export default router;
