import express from "express";
import { createWebsiteSection, deleteWebsiteSection, getWebsiteSection, getWebsiteSections, updateWebsiteSection } from "../controllers/WebsiteSectionController.js";

const router = express.Router();

// GET ALL
router.get("/", getWebsiteSections);

// GET SINGLE
router.get("/:type", getWebsiteSection);

// CREATE
router.post("/:type", createWebsiteSection);

// UPDATE
router.put("/:type", updateWebsiteSection);

// DELETE
router.delete("/:type", deleteWebsiteSection);

export default router;
