import CmsModel from "../models/CmsSchema.js";
import { v2 as cloudinary } from "cloudinary";

// Helper function to upload base64 image to Cloudinary
const uploadBase64ToCloudinary = async (base64String, folder) => {
    if (!base64String || !base64String.startsWith("data:")) {
        return base64String; // Return as-is if not base64
    }

    try {
        const result = await cloudinary.uploader.upload(base64String, {
            folder,
            resource_type: "auto",
        });
        return result.secure_url;
    } catch (error) {
        console.error("Cloudinary upload error:", error);
        throw new Error("Failed to upload media to Cloudinary");
    }
};

// Helper function to delete Cloudinary resource
const deleteCloudinaryResource = async (url) => {
    if (!url || !url.includes("cloudinary")) return;

    try {
        const publicId = url.split("/").slice(-2).join("/").split(".")[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch (error) {
        console.error("Cloudinary delete error:", error);
    }
};

// Get all CMS sections
export const getAllCmsSections = async (req, res) => {
    try {
        const sections = await CmsModel.find().sort({ sectionType: 1 });

        res.json({
            success: true,
            sections,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get single CMS section
export const getCmsSection = async (req, res) => {
    try {
        const { sectionType } = req.params;

        const section = await CmsModel.findOne({ sectionType });

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "CMS section not found",
            });
        }

        res.json({
            success: true,
            section,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update or Create CMS section
export const upsertCmsSection = async (req, res) => {
    try {
        const { sectionType } = req.params;
        const { enabled, data } = req.body;

        // Validate sectionType
        const validTypes = ["topbar", "salesbanner", "hero", "media"];
        if (!validTypes.includes(sectionType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid section type",
            });
        }

        // Get existing section if any
        const existingSection = await CmsModel.findOne({ sectionType });

        // Process data based on section type
        let processedData = { ...data };

        if (sectionType === "hero") {
            // Upload hero images if they are base64
            if (data.desktopImage && data.desktopImage.startsWith("data:")) {
                // Delete old image if exists
                if (existingSection?.data?.desktopImage) {
                    await deleteCloudinaryResource(existingSection.data.desktopImage);
                }
                processedData.desktopImage = await uploadBase64ToCloudinary(
                    data.desktopImage,
                    "cms/hero"
                );
            }

            if (data.mobileImage && data.mobileImage.startsWith("data:")) {
                // Delete old image if exists
                if (existingSection?.data?.mobileImage) {
                    await deleteCloudinaryResource(existingSection.data.mobileImage);
                }
                processedData.mobileImage = await uploadBase64ToCloudinary(
                    data.mobileImage,
                    "cms/hero"
                );
            }
        }

        if (sectionType === "media") {
            // Upload media section images/videos
            if (data.mode === "image") {
                if (data.desktopImage && data.desktopImage.startsWith("data:")) {
                    if (existingSection?.data?.desktopImage) {
                        await deleteCloudinaryResource(existingSection.data.desktopImage);
                    }
                    processedData.desktopImage = await uploadBase64ToCloudinary(
                        data.desktopImage,
                        "cms/media"
                    );
                }

                if (data.mobileImage && data.mobileImage.startsWith("data:")) {
                    if (existingSection?.data?.mobileImage) {
                        await deleteCloudinaryResource(existingSection.data.mobileImage);
                    }
                    processedData.mobileImage = await uploadBase64ToCloudinary(
                        data.mobileImage,
                        "cms/media"
                    );
                }

                // Clear video if switching from video mode
                if (existingSection?.data?.video) {
                    await deleteCloudinaryResource(existingSection.data.video);
                    processedData.video = "";
                }
            } else if (data.mode === "video") {
                if (data.video && data.video.startsWith("data:")) {
                    if (existingSection?.data?.video) {
                        await deleteCloudinaryResource(existingSection.data.video);
                    }
                    processedData.video = await uploadBase64ToCloudinary(
                        data.video,
                        "cms/media"
                    );
                }

                // Clear images if switching from image mode
                if (existingSection?.data?.desktopImage) {
                    await deleteCloudinaryResource(existingSection.data.desktopImage);
                }
                if (existingSection?.data?.mobileImage) {
                    await deleteCloudinaryResource(existingSection.data.mobileImage);
                }
                processedData.desktopImage = "";
                processedData.mobileImage = "";
            }
        }

        // Update or create section
        const section = await CmsModel.findOneAndUpdate(
            { sectionType },
            {
                enabled: enabled !== undefined ? enabled : true,
                data: processedData,
            },
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            message: "CMS section updated successfully",
            section,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete CMS section (reset to defaults)
export const deleteCmsSection = async (req, res) => {
    try {
        const { sectionType } = req.params;

        const section = await CmsModel.findOne({ sectionType });

        if (!section) {
            return res.status(404).json({
                success: false,
                message: "CMS section not found",
            });
        }

        // Delete associated media from Cloudinary
        if (sectionType === "hero") {
            if (section.data.desktopImage) {
                await deleteCloudinaryResource(section.data.desktopImage);
            }
            if (section.data.mobileImage) {
                await deleteCloudinaryResource(section.data.mobileImage);
            }
        }

        if (sectionType === "media") {
            if (section.data.desktopImage) {
                await deleteCloudinaryResource(section.data.desktopImage);
            }
            if (section.data.mobileImage) {
                await deleteCloudinaryResource(section.data.mobileImage);
            }
            if (section.data.video) {
                await deleteCloudinaryResource(section.data.video);
            }
        }

        await CmsModel.findOneAndDelete({ sectionType });

        res.json({
            success: true,
            message: "CMS section deleted successfully",
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
