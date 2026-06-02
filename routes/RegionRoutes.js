import express from "express";
import {
    createRegion,
    getRegions,
    getSingleRegion,
    updateRegion,
    deleteRegion,
} from "../controllers/RegionController.js";

const router = express.Router();

router.post("/", createRegion);
router.get("/", getRegions);
router.get("/:id", getSingleRegion);
router.put("/:id", updateRegion);
router.delete("/:id", deleteRegion);

export default router;
