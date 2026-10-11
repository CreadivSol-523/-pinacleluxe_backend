import WebsiteSection from "../models/websiteSection.js";
import { uploadMany } from "../utils/ProductUploadHelpers.js";

// GET ALL SECTIONS
export const getWebsiteSections = async (req, res) => {
   try {
      const sections = await WebsiteSection.find().sort({
         createdAt: 1,
      });

      return res.status(200).json({
         success: true,
         data: sections,
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         message: error.message,
      });
   }
};

// GET SINGLE SECTION
export const getWebsiteSection = async (req, res) => {
   try {
      const { type } = req.params;

      const section = await WebsiteSection.findOne({ type });

      if (!section) {
         return res.status(404).json({
            success: false,
            message: `${type} section not found`,
         });
      }

      return res.status(200).json({
         success: true,
         data: section,
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         message: error.message,
      });
   }
};

// CREATE SECTION
export const createWebsiteSection = async (req, res) => {
   try {
      const { type } = req.params;

      if (!type) {
         return res.status(400).json({
            success: false,
            message: "Type are required",
         });
      }

      const existingSection = await WebsiteSection.findOne({
         type,
      });

      if (existingSection) {
         return res.status(409).json({
            success: false,
            message: `${type} section already exists`,
         });
      }

      const data = { enabled: req.body.enabled == "true" ? true : false };

      // ========================= // TOPBAR // =========================
      if (type === "topbar") {
         data.message = req.body.message;
         data.bgColor = req.body.bgColor;
         data.textColor = req.body.textColor;
      }
      //   console.log(type, data);

      // ========================= // SALES BANNER // =========================
      if (type === "salesbanner") {
         data.title = req.body.title;
         data.subtitle = req.body.subtitle;
         data.bgColor = req.body.bgColor;
         data.textColor = req.body.textColor;
         data.btnLabel = req.body.btnLabel;
         data.btnUrl = req.body.btnUrl;
         data.btnBgColor = req.body.btnBgColor;
         data.btnTextColor = req.body.btnTextColor;
      }

      // ========================= // HERO // =========================
      if (type === "hero") {
         const desktopImages = await uploadMany(req.files?.desktopImage, "desktopImages");
         const mobileImages = await uploadMany(req.files?.mobileImage, "mobileImages");
         data.desktopImage = desktopImages[0] || "";
         data.mobileImage = mobileImages[0] || "";
      }

      // ========================= // Media // =========================
      if (type === "media") {
         data.mode = req.body.mode;
         const desktopImages = await uploadMany(req.files?.desktopImage, "desktopImages");
         const mobileImages = await uploadMany(req.files?.mobileImage, "mobileImages");
         const videos = await uploadMany(req.files?.video, "video");
         data.desktopImage = desktopImages[0] || "";
         data.mobileImage = mobileImages[0] || "";
         data.video = videos[0] || "";
      }

      if (type === "carousel") {
         data.enabled = req.body.enabled === "true" || req.body.enabled === true;

         const slidesMeta = JSON.parse(req.body.slides || "[]");
         const slides = [];

         for (let i = 0; i < slidesMeta.length; i++) {
            const slideFile = req.files?.[`image_${i}`];
            let imageUrl = slidesMeta[i].image;

            if (slideFile) {
               const uploaded = await uploadMany(slideFile, "carousel");
               imageUrl = uploaded[0];
            }

            slides.push({
               image: imageUrl,
               text: slidesMeta[i].text,
            });
         }

         data.slides = slides;
      }

      if (type === "stories") {
         const bannerImageWeb = await uploadMany(req.files?.bannerImageWeb, "bannerImageWeb");
         const bannerImageMobile = await uploadMany(req.files?.bannerImageMobile, "bannerImageMobile");
         const sectionImageWeb = await uploadMany(req.files?.sectionImageWeb, "sectionImageWeb");
         const sectionImageMobile = await uploadMany(req.files?.sectionImageMobile, "sectionImageMobile");
         data.bannerImageWeb = bannerImageWeb[0] || "";
         data.bannerImageMobile = bannerImageMobile[0] || "";
         data.sectionImageWeb = sectionImageWeb[0] || "";
         data.sectionImageMobile = sectionImageMobile[0] || "";
         data.title = req.body.title;
         data.subtitle = req.body.subtitle;
      }
      const section = await WebsiteSection.create({
         type,
         data,
      });

      return res.status(201).json({
         success: true,
         message: `${type} section created successfully`,
         data: section,
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         message: error.message,
      });
   }
};

// UPDATE SECTION
export const updateWebsiteSection = async (req, res) => {
   try {
      const { type } = req.params;

      const section = await WebsiteSection.findOne({ type });

      if (!section) {
         return res.status(404).json({ success: false, message: `${type} section not found` });
      }

      const currentData = section.data || {};

      const data = { ...currentData, enabled: req.body.enabled !== undefined ? req.body.enabled === "true" : currentData.enabled };

      // TOPBAR
      if (type === "topbar") {
         data.message = req.body.message ?? currentData.message;
         data.bgColor = req.body.bgColor ?? currentData.bgColor;
         data.textColor = req.body.textColor ?? currentData.textColor;
      }

      // SALES BANNER
      else if (type === "salesbanner") {
         data.title = req.body.title ?? currentData.title;
         data.subtitle = req.body.subtitle ?? currentData.subtitle;
         data.bgColor = req.body.bgColor ?? currentData.bgColor;
         data.textColor = req.body.textColor ?? currentData.textColor;
         data.btnLabel = req.body.btnLabel ?? currentData.btnLabel;
         data.btnUrl = req.body.btnUrl ?? currentData.btnUrl;
         data.btnBgColor = req.body.btnBgColor ?? currentData.btnBgColor;
         data.btnTextColor = req.body.btnTextColor ?? currentData.btnTextColor;
      }
      // HERO
      else if (type === "hero") {
         const desktopImage = req.files?.desktopImage;
         const mobileImage = req.files?.mobileImage;
         if (desktopImage) {
            const desktopImages = await uploadMany(desktopImage, "desktopImages");
            if (desktopImages.length > 0) {
               data.desktopImage = desktopImages[0];
            }
         }
         if (mobileImage) {
            const mobileImages = await uploadMany(mobileImage, "mobileImages");
            if (mobileImages.length > 0) {
               data.mobileImage = mobileImages[0];
            }
         }
      }
      // MEDIA
      else if (type === "media") {
         data.mode = req.body.mode ?? currentData.mode;
         const desktopImage = req.files?.desktopImage;
         const mobileImage = req.files?.mobileImage;
         const video = req.files?.video;
         if (desktopImage) {
            const desktopImages = await uploadMany(desktopImage, "desktopImages");
            if (desktopImages.length > 0) {
               data.desktopImage = desktopImages[0];
            }
         }
         if (mobileImage) {
            const mobileImages = await uploadMany(mobileImage, "mobileImages");
            if (mobileImages.length > 0) {
               data.mobileImage = mobileImages[0];
            }
         }
         if (video) {
            const videos = await uploadMany(video, "video");
            if (videos.length > 0) {
               data.video = videos[0];
            }
         }
      }

      // CAROUSEL
      else if (type === "carousel") {
         const slidesMeta = JSON.parse(req.body.slides || "[]");
         const slides = [];

         for (let i = 0; i < slidesMeta.length; i++) {
            const slideFile = req.files?.[`image_${i}`];
            let imageUrl = slidesMeta[i].image;

            if (slideFile) {
               const uploaded = await uploadMany(slideFile, "carousel");
               if (uploaded.length > 0) {
                  imageUrl = uploaded[0];
               }
            }

            slides.push({
               image: imageUrl,
               text: slidesMeta[i].text,
            });
         }

         data.slides = slides;
      } else if (type === "stories") {
         const bannerImageWeb = req.files?.bannerImageWeb;
         const bannerImageMobile = req.files?.bannerImageMobile;
         const sectionImageWeb = req.files?.sectionImageWeb;
         const sectionImageMobile = req.files?.sectionImageMobile;

         if (bannerImageWeb) {
            const uploaded = await uploadMany(bannerImageWeb, "bannerImageWeb");

            if (uploaded.length > 0) {
               data.bannerImageWeb = uploaded[0];
            }
         }

         if (bannerImageMobile) {
            const uploaded = await uploadMany(bannerImageMobile, "bannerImageMobile");

            if (uploaded.length > 0) {
               data.bannerImageMobile = uploaded[0];
            }
         }

         if (sectionImageWeb) {
            const uploaded = await uploadMany(sectionImageWeb, "sectionImageWeb");

            if (uploaded.length > 0) {
               data.sectionImageWeb = uploaded[0];
            }
         }

         if (sectionImageMobile) {
            const uploaded = await uploadMany(sectionImageMobile, "sectionImageMobile");

            if (uploaded.length > 0) {
               data.sectionImageMobile = uploaded[0];
            }
         }

         data.title = req.body.title ?? currentData.title;
         data.subtitle = req.body.subtitle ?? currentData.subtitle;
      } else {
         return res.status(400).json({ success: false, message: "Invalid section type" });
      }
      // else if (type === "stories") {
      //          const bannerImageWeb = await uploadMany(req.files?.bannerImageWeb, "bannerImageWeb");
      //          const bannerImageWeb = await uploadMany(req.files?.bannerImageWeb, "bannerImageWeb");
      //          const sectionImageWeb = await uploadMany(req.files?.sectionImageWeb, "sectionImageWeb");
      //          const sectionImageMobile = await uploadMany(req.files?.sectionImageMobile, "sectionImageMobile");
      //          data.bannerImageWeb = bannerImageWeb[0] || "";
      //          data.bannerImageWeb = bannerImageWeb[0] || "";
      //          data.sectionImageWeb = sectionImageWeb[0] || "";
      //          data.sectionImageMobile = sectionImageMobile[0] || "";
      //          data.title = req.body.title;
      //          data.subtitle = req.body.subtitle;
      //       }
      section.data = data;

      await section.save();

      // const section = await WebsiteSection.findOneAndUpdate(
      //    { type },
      //    { data },
      //    {
      //       new: true,
      //       runValidators: true,
      //    },
      // );

      return res.status(200).json({
         success: true,
         message: `${type} section updated successfully`,
         data: section,
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         message: error.message,
      });
   }
};

// DELETE SECTION
export const deleteWebsiteSection = async (req, res) => {
   try {
      const { type } = req.params;

      const section = await WebsiteSection.findOneAndDelete({
         type,
      });

      if (!section) {
         return res.status(404).json({
            success: false,
            message: `${type} section not found`,
         });
      }

      return res.status(200).json({
         success: true,
         message: `${type} section deleted successfully`,
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         message: error.message,
      });
   }
};
