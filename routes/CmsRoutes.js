import express from "express";
import {
    getAllCmsSections,
    getCmsSection,
    upsertCmsSection,
    deleteCmsSection,
} from "../controllers/CmsController.js";

const router = express.Router();

router.get("/", getAllCmsSections);
router.get("/:sectionType", getCmsSection);
router.put("/:sectionType", upsertCmsSection);
router.delete("/:sectionType", deleteCmsSection);

export default router;
