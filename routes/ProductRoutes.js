import express from "express";
import {
    getProducts,
    getSingleProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
} from "../controllers/ProductController.js";

const router = express.Router();

router.get("/", getProducts);
router.get("/:id", getSingleProduct);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);
router.patch("/:id/stock", adjustStock); // Inventory Stock Adjustment endpoint

export default router;
