import express from "express";
import {
    createOrder,
    getOrders,
    getSingleOrder,
    updateOrderStatus,
} from "../controllers/OrderController.js";

const router = express.Router();

router.post("/", createOrder);
router.get("/", getOrders);
router.get("/:id", getSingleOrder);
router.patch("/:id/status", updateOrderStatus);

export default router;
