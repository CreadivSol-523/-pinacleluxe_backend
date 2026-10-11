import ProductModel from "../models/ProductSchema.js";
import CategoryModel from "../models/CategorySchema.js";
import slugify from "slugify";
import { v2 as cloudinary } from "cloudinary";

// Get all products with search, filtering, pagination
export const getProducts = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search = "", category, isActive } = req.query;
        const query = {};

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }
        if (category) {
            query.category = category;
        }
        if (isActive !== undefined) {
            query.isActive = isActive === "true";
        }

        const skip = (Number(page) - 1) * Number(limit);
        const products = await ProductModel.find(query)
            .populate("category", "name slug")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await ProductModel.countDocuments(query);

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            products,
        });
    } catch (error) {
        next(error);
    }
};

// Get single product
export const getSingleProduct = async (req, res, next) => {
    try {
        const product = await ProductModel.findById(req.params.id).populate("category", "name slug");
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        res.status(200).json({ success: true, product });
    } catch (error) {
        next(error);
    }
};

// Create product with stock management
export const createProduct = async (req, res, next) => {
    try {
        let { name, description, price, comparePrice, stock, sku, lowStockThreshold, category, isActive } = req.body;

        if (!name || price === undefined || stock === undefined || !category) {
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

        const product = await ProductModel.create({
            name,
            slug: uniqueSlug,
            description,
            price: Number(price),
            comparePrice: comparePrice ? Number(comparePrice) : undefined,
            stock: Number(stock),
            sku: sku || undefined,
            lowStockThreshold: lowStockThreshold ? Number(lowStockThreshold) : 5,
            category,
            images,
            isActive: isActive !== undefined ? isActive : true,
        });

        res.status(201).json({ success: true, product });
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

        const product = await ProductModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        res.status(200).json({ success: true, product });
    } catch (error) {
        next(error);
    }
};

// Delete product
export const deleteProduct = async (req, res, next) => {
    try {
        const product = await ProductModel.findByIdAndDelete(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        res.status(200).json({ success: true, message: "Product deleted successfully" });
    } catch (error) {
        next(error);
    }
};

// Inventory Adjustment API (Restock / Manual Adjustment with audit logging capability)
export const adjustStock = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { adjustment, type } = req.body; // type: 'add' or 'set', adjustment: number

        if (adjustment === undefined) {
            return res.status(400).json({ success: false, message: "Adjustment value is required" });
        }

        const product = await ProductModel.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (type === "set") {
            product.stock = Number(adjustment);
        } else {
            // default add (or subtract if negative)
            product.stock = Math.max(0, product.stock + Number(adjustment));
        }

        await product.save();

        res.status(200).json({
            success: true,
            message: "Stock updated successfully",
            product: {
                id: product._id,
                name: product.name,
                stock: product.stock,
                lowStockThreshold: product.lowStockThreshold,
                isLowStock: product.stock <= product.lowStockThreshold,
            },
        });
    } catch (error) {
        next(error);
    }
};
