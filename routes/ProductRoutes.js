import express from "express";
import { getProducts, getProductDropdownList, getProductFilters, getSingleProduct, createProduct, updateProduct, deleteProduct, adjustStock, bulkDeleteProducts } from "../controllers/ProductController.js";

const router = express.Router();

router.get("/", getProducts);
router.get("/dropdown-list", getProductDropdownList); // Lightweight endpoint for dropdown selection of accessories
router.get("/filter", getProductFilters); // Dedicated product filter options endpoint
router.get("/:id", getSingleProduct);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);
router.delete("/bulk/delete", bulkDeleteProducts);
router.patch("/:id/stock", adjustStock); // Inventory Stock Adjustment endpoint

export default router;
