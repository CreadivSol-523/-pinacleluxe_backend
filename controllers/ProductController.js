import ProductModel from "../models/ProductSchema.js";
import CategoryModel from "../models/CategorySchema.js";
import slugify from "slugify";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";

// Get all products with search, filtering, pagination, and region population
export const getProducts = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search = "", category, isActive } = req.query;
        const query = {};

        if (search) {
            if (typeof search === 'object') {
                if (search.badge) {
                    query.badge = { $regex: search.badge, $options: "i" };
                }
                if (search.material) {
                    query["variants.material"] = { $regex: search.material, $options: "i" };
                }
                if (search.color) {
                    query["variants.colors.hex.colorName"] = { $regex: search.color, $options: "i" };
                }
            } else {
                query.name = { $regex: search, $options: "i" };
            }
        }
        if (category) {
            let catId = category;
            if (!mongoose.Types.ObjectId.isValid(category)) {
                const foundCategory = await CategoryModel.findOne({
                    $or: [
                        { slug: category },
                        { name: { $regex: new RegExp(`^${category}$`, "i") } }
                    ]
                });
                if (foundCategory) {
                    catId = foundCategory._id;
                } else {
                    return res.status(404).json({
                        success: false,
                        message: `Category not found: ${category}`
                    });
                }
            }
            query.$or = [
                { category: catId },
                { categories: catId }
            ];
        }
        if (isActive !== undefined) {
            query.isActive = isActive === "true";
        }

        const skip = (Number(page) - 1) * Number(limit);
        const products = await ProductModel.find(query)
            .populate("category", "name slug")
            .populate("categories", "name slug")
            .populate("accessories")
            .populate("pricing.region", "name code currency")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await ProductModel.countDocuments(query);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / Number(limit)),
                limit: Number(limit)
            },
            products,
        });
    } catch (error) {
        next(error);
    }
};

// Get product filters (badges, colors, materials)
export const getProductFilters = async (req, res, next) => {
    try {
        const { category } = req.query;
        const query = {};

        if (category) {
            let catId = category;
            if (!mongoose.Types.ObjectId.isValid(category)) {
                const foundCategory = await CategoryModel.findOne({
                    $or: [
                        { slug: category },
                        { name: { $regex: new RegExp(`^${category}$`, "i") } }
                    ]
                });
                if (foundCategory) {
                    catId = foundCategory._id;
                }
            }
            if (mongoose.Types.ObjectId.isValid(catId)) {
                query.$or = [
                    { category: catId },
                    { categories: catId }
                ];
            }
        }

        const products = await ProductModel.find(query).select("badge variants");

        const badgesSet = new Set();
        const colorsSet = new Set();
        const materialsSet = new Set();

        products.forEach(p => {
            if (p.badge) badgesSet.add(p.badge);
            if (p.variants && Array.isArray(p.variants)) {
                p.variants.forEach(v => {
                    if (v.material) materialsSet.add(v.material);
                    if (v.colors && Array.isArray(v.colors)) {
                        v.colors.forEach(c => {
                            if (c.hex) {
                                if (c.hex.colorName) colorsSet.add(c.hex.colorName);
                                if (c.hex.code && !c.hex.colorName) colorsSet.add(c.hex.code);
                            }
                        });
                    }
                });
            }
        });

        res.status(200).json({
            success: true,
            filters: {
                badges: Array.from(badgesSet),
                colors: Array.from(colorsSet),
                materials: Array.from(materialsSet),
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get product list for dropdown (lightweight with search & pagination)
export const getProductDropdownList = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, search = "" } = req.query;
        const query = { isActive: true };

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const skip = (Number(page) - 1) * Number(limit);
        const products = await ProductModel.find(query)
            .select("name price pricing images sku stock")
            .populate("pricing.region", "name code currency")
            .skip(skip)
            .limit(Number(limit))
            .sort({ name: 1 });

        const total = await ProductModel.countDocuments(query);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / Number(limit)),
                limit: Number(limit)
            },
            products,
        });
    } catch (error) {
        next(error);
    }
};

// Get single product with region pricing and accessories populated (supports lookup by _id or slug)
export const getSingleProduct = async (req, res, next) => {
    try {
        const identifier = req.params.id;
        let product;

        if (mongoose.Types.ObjectId.isValid(identifier)) {
            product = await ProductModel.findById(identifier);
        } else {
            product = await ProductModel.findOne({ slug: identifier });
        }

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Populate references
        await product.populate([
            { path: "category", select: "name slug" },
            { path: "categories", select: "name slug" },
            { path: "accessories" },
            { path: "pricing.region", select: "name code currency" }
        ]);

        res.status(200).json({ success: true, product });
    } catch (error) {
        next(error);
    }
};

// Create product with stock management, accessories, and regional pricing
export const createProduct = async (req, res, next) => {
    try {
        let { name, description, price, comparePrice, stock, sku, lowStockThreshold, category, categories, isActive, accessories, pricing } = req.body;

        if (!name || price === undefined || stock === undefined || (!category && (!categories || categories.length === 0))) {
            return res.status(400).json({ success: false, message: "Please provide name, price, stock, and category" });
        }

        let images = [];
        if (req.files && req.files.images) {
            const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
            for (const file of files) {
                const upload = await cloudinary.uploader.upload(file.tempFilePath, {
                    folder: "products",
                });
                images.push(upload.secure_url);
            }
        }

        const slug = slugify(name, { lower: true, strict: true });
        let uniqueSlug = slug;
        let count = 1;
        while (await ProductModel.findOne({ slug: uniqueSlug })) {
            uniqueSlug = `${slug}-${count++}`;
        }

        // Parse accessories if passed as JSON string or array
        let parsedAccessories = [];
        if (accessories) {
            try {
                parsedAccessories = typeof accessories === 'string' ? JSON.parse(accessories) : accessories;
            } catch (e) {
                parsedAccessories = Array.isArray(accessories) ? accessories : [accessories];
            }
        }

        // Parse pricing if passed as JSON string or array
        let parsedPricing = [];
        if (pricing) {
            try {
                parsedPricing = typeof pricing === 'string' ? JSON.parse(pricing) : pricing;
            } catch (e) {
                parsedPricing = Array.isArray(pricing) ? pricing : [pricing];
            }
        }

        let parsedCategories = [];
        if (categories) {
            try {
                parsedCategories = typeof categories === 'string' ? JSON.parse(categories) : categories;
            } catch (e) {
                parsedCategories = Array.isArray(categories) ? categories : [categories];
            }
        }

        const product = await ProductModel.create({
            name,
            slug: uniqueSlug,
            description,
            price: Number(price),
            comparePrice: comparePrice ? Number(comparePrice) : undefined,
            stock: Number(stock),
            sku: sku || undefined,
            lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : 5,
            category: category || (parsedCategories[0] ? parsedCategories[0] : undefined),
            categories: parsedCategories,
            images,
            isActive: isActive !== undefined ? isActive === "true" || isActive === true : true,
            accessories: parsedAccessories,
            pricing: parsedPricing,
        });

        res.status(201).json({
            success: true,
            message: "Product created successfully",
            product,
        });
    } catch (error) {
        next(error);
    }
};

// Update product
export const updateProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        let updateData = { ...req.body };

        if (updateData.name) {
            updateData.slug = slugify(updateData.name, { lower: true, strict: true });
        }

        if (req.files && req.files.images) {
            let images = [];
            const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
            for (const file of files) {
                const upload = await cloudinary.uploader.upload(file.tempFilePath, {
                    folder: "products",
                });
                images.push(upload.secure_url);
            }
            updateData.images = images;
        }

        if (updateData.accessories && typeof updateData.accessories === 'string') {
            try {
                updateData.accessories = JSON.parse(updateData.accessories);
            } catch (e) {}
        }

        if (updateData.pricing && typeof updateData.pricing === 'string') {
            try {
                updateData.pricing = JSON.parse(updateData.pricing);
            } catch (e) {}
        }

        if (updateData.categories && typeof updateData.categories === 'string') {
            try {
                updateData.categories = JSON.parse(updateData.categories);
            } catch (e) {}
        }

        const queryId = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };
        const product = await ProductModel.findOneAndUpdate(queryId, updateData, {
            new: true,
            runValidators: true,
        });

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.status(200).json({
            success: true,
            message: "Product updated successfully",
            product,
        });
    } catch (error) {
        next(error);
    }
};

// Delete product
export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        const queryId = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };
        const product = await ProductModel.findOneAndDelete(queryId);

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

// Adjust stock
export const adjustStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { quantity, operation = "set" } = req.body;

        const queryId = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };
        const product = await ProductModel.findOne(queryId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (operation === "add") {
            product.stock += Number(quantity);
        } else if (operation === "subtract") {
            product.stock = Math.max(0, product.stock - Number(quantity));
        } else {
            product.stock = Number(quantity);
        }

        await product.save();

        res.status(200).json({
            success: true,
            message: "Product stock adjusted successfully",
            product,
        });
    } catch (error) {
        next(error);
    }
};
