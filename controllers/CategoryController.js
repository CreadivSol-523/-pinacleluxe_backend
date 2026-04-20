import slugify from "slugify";
import CategoryModel from "../models/CategorySchema.js"
import { v2 as cloudinary } from "cloudinary";

export const createCategory = async (req, res) => {
    try {
        let { name, isActive, parentId } = req.body;
        const file = req.files.image;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Name is required",
            });
        }

        // ✅ FIX: normalize "null" string → real null
        if (!parentId || parentId === "null" || parentId === "") {
            parentId = null;
        }

        // ✅ Validate parent ONLY if real id exists
        if (parentId) {
            const parentExists = await CategoryModel.exists({ _id: parentId });

            if (!parentExists) {
                return res.status(400).json({
                    success: false,
                    message: "Parent category not found",
                });
            }
        }

        // 🔥 Upload Image
        let imageUrl = null;

        if (req.files) {
            const upload = await cloudinary.uploader.upload(file.tempFilePath, {
                folder: "categories",
            });

            imageUrl = upload.secure_url;
        }

        // 🔗 Slug
        const slug = slugify(name, { lower: true, strict: true });

        let uniqueSlug = slug;
        let count = 1;

        while (await CategoryModel.findOne({ slug: uniqueSlug })) {
            uniqueSlug = `${slug}-${count++}`;
        }

        const category = await CategoryModel.create({
            name,
            slug: uniqueSlug,
            image: imageUrl,
            isActive,
            parentId, // ✅ now always clean
        });

        res.status(201).json({
            success: true,
            category,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getCategories = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            isActive,
            parentId,
        } = req.query;

        const match = {};

        // 🔍 Search
        if (search) {
            match.name = { $regex: search, $options: "i" };
        }

        // ✅ Active filter
        if (isActive !== undefined) {
            match.isActive = isActive === "true";
        }

        // 🌳 Parent filter
        if (parentId === "null") {
            match.parentId = null;
        } else if (parentId) {
            match.parentId = new mongoose.Types.ObjectId(parentId);
        }

        const skip = (Number(page) - 1) * Number(limit);

        const categories = await CategoryModel.aggregate([
            { $match: match },

            { $sort: { createdAt: -1 } },

            { $skip: skip },
            { $limit: Number(limit) },

            {
                $graphLookup: {
                    from: "categories",
                    startWith: "$_id",
                    connectFromField: "_id",
                    connectToField: "parentId",
                    as: "children",
                    maxDepth: 5,
                    restrictSearchWithMatch: { isActive: true },
                },
            },
        ]);

        const total = await CategoryModel.countDocuments(match);

        res.json({
            success: true,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit),
            },
            categories,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getSingleCategory = async (req, res) => {
    try {
        const category = await CategoryModel.findById(req.params.id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        res.json({
            success: true,
            category,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getSingleCategoryTree = async (req, res) => {
    try {
        const category = await CategoryModel.aggregate([
            {
                $match: { _id: new mongoose.Types.ObjectId(req.params.id) },
            },
            {
                $graphLookup: {
                    from: "categories",
                    startWith: "$_id",
                    connectFromField: "_id",
                    connectToField: "parentId",
                    as: "children",
                    maxDepth: 5,
                },
            },
        ]);

        if (!category.length) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        res.json({
            success: true,
            category: category[0],
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateCategory = async (req, res) => {
    try {
        let { name, isActive, parentId } = req.body;

        const category = await CategoryModel.findById(req.params.id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }

        // ✅ FIX: normalize parentId
        if (!parentId || parentId === "null" || parentId === "") {
            parentId = null;
        }

        // ❌ Prevent self-parent
        if (parentId && parentId === req.params.id) {
            return res.status(400).json({
                success: false,
                message: "Category cannot be its own parent",
            });
        }

        // ✅ Validate parent
        if (parentId) {
            const parentExists = await CategoryModel.exists({ _id: parentId });

            if (!parentExists) {
                return res.status(400).json({
                    success: false,
                    message: "Parent category not found",
                });
            }
        }

        let imageUrl = category.image;

        if (req.files && req.files.image) {
            // delete old image
            if (category.image) {
                const publicId = category.image
                    .split("/")
                    .pop()
                    .split(".")[0];

                await cloudinary.uploader.destroy(`categories/${publicId}`);
            }

            const file = req.files.image;

            const upload = await cloudinary.uploader.upload(file.tempFilePath, {
                folder: "categories",
            });

            imageUrl = upload.secure_url;
        }

        // 🔄 Update name + slug
        if (name) {
            const baseSlug = slugify(name, { lower: true, strict: true });
            let uniqueSlug = baseSlug;
            let count = 1;
            while (
                await CategoryModel.findOne({
                    slug: uniqueSlug,
                    _id: { $ne: category._id },
                })
            ) {
                uniqueSlug = `${baseSlug}-${count++}`;
            }
            category.name = name;
            category.slug = uniqueSlug;
        }

        // ✏️ Apply updates
        category.image = imageUrl;
        category.isActive = isActive ?? category.isActive;
        category.parentId = parentId;

        await category.save();

        res.json({
            success: true,
            category,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteCategory = async (req, res) => {
    try {
        const hasChildren = await CategoryModel.exists({
            parentId: req.params.id,
        });

        if (hasChildren) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete category with children",
            });
        }

        await CategoryModel.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "Deleted successfully",
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};