import express from "express";

import validate from "../middlewares/ValidationHandler.js";

import AuthMiddleware from "../middlewares/AuthMiddleware.js";
import AccessMiddleware from "../middlewares/AccessMiddleware.js";
import { handleGetRealtimeCounter, handleRealtimeCounter } from "../controllers/CounterController.js";

const router = express.Router();

router.patch("/update-seq", AuthMiddleware, AccessMiddleware(["Admin", "User"]), handleRealtimeCounter)

router.get("/get-seq", handleGetRealtimeCounter)

export default router;