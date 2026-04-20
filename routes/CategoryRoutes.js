import express from "express";
import {
    createCategory,
    getCategories,
    getSingleCategory,
    updateCategory,
    deleteCategory,
} from "../controllers/CategoryController.js";

const router = express.Router();

router.post("/", createCategory);
router.get("/", getCategories);
router.get("/:id", getSingleCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;