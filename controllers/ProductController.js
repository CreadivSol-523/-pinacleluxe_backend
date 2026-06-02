import mongoose from "mongoose";
import slugify from "slugify";
import ProductModel from "../models/ProductSchema.js";
import CategoryModel from "../models/CategorySchema.js";
import RegionModel from "../models/RegionSchema.js";
import {
    uploadMany,
    destroyCloudinaryUrls,
    collectProductImageUrls,
    collectVariantImageUrls,
    buildProcessedVariants,
    buildProcessedVariantsForUpdate,
} from "../utils/ProductUploadHelpers.js";

export const createProduct = async (req, res) => {
    try {
        let {
            name,
            description,
            categories,
            badge,
            isVariable,
            pricing,
            variants,
            stock,
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Name is required",
            });
        }

        if (typeof categories === "string") {
            categories = JSON.parse(categories);
        }

        if (!Array.isArray(categories) || categories.length === 0) {
            return res.status(400).json({
                success: false,
                message: "categories must be a non-empty array",
            });
        }

        const existingCategories = await CategoryModel.find({
            _id: { $in: categories },
        });

        if (existingCategories.length !== categories.length) {
            return res.status(400).json({
                success: false,
                message: "Invalid categories",
            });
        }

        if (typeof pricing === "string") {
            pricing = JSON.parse(pricing);
        }

        if (pricing != null && !Array.isArray(pricing)) {
            return res.status(400).json({
                success: false,
                message: "pricing must be an array",
            });
        }

        if (isVariable === false && (!pricing || pricing.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Non-variable products must include pricing",
            });
        }

        // Validate and resolve top-level pricing region references to ObjectIds
        if (Array.isArray(pricing) && pricing.length > 0) {
            const processedPricing = [];
            for (const entry of pricing) {
                const { region: regionRef, price: regionPrice, discountMode, discountValue } = entry || {};

                if (!regionRef || regionPrice == null) {
                    return res.status(400).json({
                        success: false,
                        message: "Each pricing entry must include region and price",
                    });
                }

                let region;
                if (mongoose.Types.ObjectId.isValid(regionRef)) {
                    region = await RegionModel.findById(regionRef);
                } else if (typeof regionRef === "string") {
                    region = await RegionModel.findOne({ code: regionRef.toUpperCase().trim() });
                }

                if (!region) {
                    return res.status(400).json({
                        success: false,
                        message: `Region not found: ${regionRef}`,
                    });
                }

                processedPricing.push({
                    region: region._id,
                    price: Number(regionPrice),
                    discountMode,
                    discountValue: discountValue || 0,
                });
            }

            pricing = processedPricing;
        }

        if (typeof variants === "string") {
            variants = JSON.parse(variants);
        }

        if (!Array.isArray(variants)) {
            return res.status(400).json({
                success: false,
                message: "variants must be an array",
            });
        }

        let processedVariants;
        try {
            processedVariants = await buildProcessedVariants(
                variants,
                req.files
            );
        } catch (e) {
            const status = e.status || 500;
            return res.status(status).json({
                success: false,
                message: e.message,
            });
        }

        const images = await uploadMany(
            req.files?.productImages,
            "products"
        );

        const slug = slugify(name, { lower: true, strict: true });

        let uniqueSlug = slug;
        let count = 1;

        while (await ProductModel.findOne({ slug: uniqueSlug })) {
            uniqueSlug = `${slug}-${count++}`;
        }

        const product = await ProductModel.create({
            name,
            slug: uniqueSlug,
            description,
            categories,
            badge,
            isVariable,
            pricing,
            variants: processedVariants,
            stock,
            images,
        });

        res.status(201).json({
            success: true,
            product,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

export const getProducts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            category,
        } = req.query;

        const query = {};

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        if (category) {
            query.categories = category;
        }

        const limitNum = Number(limit);
        const pageNum = Number(page);
        const skip = (pageNum - 1) * limitNum;

        const products = await ProductModel.find(query)
            .populate("categories")
            .populate("variants.price.region")
            .skip(skip)
            .limit(limitNum)
            .sort({ createdAt: -1 });

        const total = await ProductModel.countDocuments(query);

        res.json({
            success: true,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum) || 0,
            },
            products,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getSingleProduct = async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id)
            .populate("categories")
            .populate("variants.price.region");

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        res.json({
            success: true,
            product,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateProduct = async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.images;

        const product = await ProductModel.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        if (updateData.name) {
            const slug = slugify(updateData.name, {
                lower: true,
                strict: true,
            });

            let uniqueSlug = slug;
            let count = 1;

            while (
                await ProductModel.findOne({
                    slug: uniqueSlug,
                    _id: { $ne: product._id },
                })
            ) {
                uniqueSlug = `${slug}-${count++}`;
            }

            updateData.slug = uniqueSlug;
        }

        if (typeof updateData.categories === "string") {
            updateData.categories = JSON.parse(updateData.categories);
        }

        if (updateData.categories) {
            if (!Array.isArray(updateData.categories)) {
                return res.status(400).json({
                    success: false,
                    message: "categories must be an array",
                });
            }

            const invalidIds = updateData.categories.filter(
                (id) => !mongoose.Types.ObjectId.isValid(id)
            );

            if (invalidIds.length) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category IDs",
                    invalidIds,
                });
            }

            const existing = await CategoryModel.find({
                _id: { $in: updateData.categories },
            });

            if (existing.length !== updateData.categories.length) {
                return res.status(400).json({
                    success: false,
                    message: "Some categories do not exist",
                });
            }
        }

        if (typeof updateData.variants === "string") {
            updateData.variants = JSON.parse(updateData.variants);
        }

        if (typeof updateData.pricing === "string") {
            updateData.pricing = JSON.parse(updateData.pricing);
        }

        if (updateData.pricing != null && !Array.isArray(updateData.pricing)) {
            return res.status(400).json({
                success: false,
                message: "pricing must be an array",
            });
        }

        // If pricing provided in update, resolve region refs
        if (Array.isArray(updateData.pricing) && updateData.pricing.length > 0) {
            const processedPricing = [];
            for (const entry of updateData.pricing) {
                const { region: regionRef, price: regionPrice, discountMode, discountValue } = entry || {};

                if (!regionRef || regionPrice == null) {
                    return res.status(400).json({
                        success: false,
                        message: "Each pricing entry must include region and price",
                    });
                }

                let region;
                if (mongoose.Types.ObjectId.isValid(regionRef)) {
                    region = await RegionModel.findById(regionRef);
                } else if (typeof regionRef === "string") {
                    region = await RegionModel.findOne({ code: regionRef.toUpperCase().trim() });
                }

                if (!region) {
                    return res.status(400).json({
                        success: false,
                        message: `Region not found: ${regionRef}`,
                    });
                }

                processedPricing.push({
                    region: region._id,
                    price: Number(regionPrice),
                    discountMode,
                    discountValue: discountValue || 0,
                });
            }

            updateData.pricing = processedPricing;
        }

        if (updateData.variants) {
            if (!Array.isArray(updateData.variants)) {
                return res.status(400).json({
                    success: false,
                    message: "variants must be an array",
                });
            }

            const oldVariantUrls = collectVariantImageUrls(product.variants);

            try {
                updateData.variants = await buildProcessedVariantsForUpdate(
                    updateData.variants,
                    req.files,
                    product.variants
                );
            } catch (e) {
                const status = e.status || 400;
                return res.status(status).json({
                    success: false,
                    message: e.message,
                });
            }

            const newVariantUrlSet = new Set(
                collectVariantImageUrls(updateData.variants)
            );
            await destroyCloudinaryUrls(
                oldVariantUrls.filter((u) => !newVariantUrlSet.has(u))
            );
        }

        if (req.files?.productImages) {
            const newProductImages = await uploadMany(
                req.files.productImages,
                "products"
            );
            if (newProductImages.length > 0) {
                await destroyCloudinaryUrls(product.images || []);
                updateData.images = newProductImages;
            }
        }

        const updated = await ProductModel.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        );

        res.json({
            success: true,
            product: updated,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const product = await ProductModel.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        const urls = collectProductImageUrls(product);
        await destroyCloudinaryUrls(urls);

        await ProductModel.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
