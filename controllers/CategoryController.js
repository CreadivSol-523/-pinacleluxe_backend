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

        if (search) {
            match.name = { $regex: search, $options: "i" };
        }

        if (isActive !== undefined) {
            match.isActive = isActive === "true";
        }

        if (parentId === "null") {
            match.parentId = null;
        } else if (parentId) {
            match.parentId = new mongoose.Types.ObjectId(parentId);
        }

        const skip = (Number(page) - 1) * Number(limit);

        // Sari categories ek baar fetch karo (match ke saath)
        const allCategories = await CategoryModel.find(match)
            .sort({ createdAt: -1 })
            .lean();

        // Map banao id => category
        const categoryMap = {};
        allCategories.forEach(cat => {
            cat.children = [];
            categoryMap[cat._id.toString()] = cat;
        });

        // Tree build karo
        const roots = [];
        allCategories.forEach(cat => {
            if (cat.parentId) {
                const parent = categoryMap[cat.parentId.toString()];
                if (parent) {
                    parent.children.push(cat);
                } else {
                    // Parent is filtered out (e.g. inactive) — treat as root
                    roots.push(cat);
                }
            } else {
                roots.push(cat);
            }
        });

        // Pagination roots pe lagao
        const total = roots.length;
        const paginatedRoots = roots.slice(skip, skip + Number(limit));

        res.json({
            success: true,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit)),
            },
            categories: paginatedRoots,
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
        const { name, isActive } = req.body;

        // Normalize parentId — only if explicitly sent in body
        const hasParentId = Object.prototype.hasOwnProperty.call(req.body, "parentId");
        let parentId = hasParentId ? req.body.parentId : undefined;

        if (hasParentId && (!parentId || parentId === "null" || parentId === "")) {
            parentId = null;
        }

        // Fetch category
        const category = await CategoryModel.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        // Prevent self-parent
        if (parentId && parentId === req.params.id) {
            return res.status(400).json({ success: false, message: "Category cannot be its own parent" });
        }

        // Validate parent exists
        if (parentId) {
            const parentExists = await CategoryModel.exists({ _id: parentId });
            if (!parentExists) {
                return res.status(400).json({ success: false, message: "Parent category not found" });
            }
        }

        // Handle image upload
        if (req.files?.image) {
            if (category.image) {
                const publicId = category.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(`categories/${publicId}`);
            }

            const upload = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
                folder: "categories",
            });

            category.image = upload.secure_url;
        }

        // Update name + slug
        if (name) {
            const baseSlug = slugify(name, { lower: true, strict: true });
            let uniqueSlug = baseSlug;
            let count = 1;
            while (await CategoryModel.findOne({ slug: uniqueSlug, _id: { $ne: category._id } })) {
                uniqueSlug = `${baseSlug}-${count++}`;
            }
            category.name = name;
            category.slug = uniqueSlug;
        }

        // Update isActive — only if sent
        if (isActive !== undefined) {
            category.isActive = isActive;
        }

        // Update parentId — only if explicitly sent in body
        if (hasParentId) {
            category.parentId = parentId;
        }

        await category.save();

        res.json({ success: true, category });
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