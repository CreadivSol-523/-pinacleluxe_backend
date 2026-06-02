import RegionModel from "../models/RegionSchema.js";
import ProductModel from "../models/ProductSchema.js";

export const createRegion = async (req, res) => {
    try {
        let { name, code, currency, isActive, description } = req.body;

        if (!name || !code || !currency) {
            return res.status(400).json({
                success: false,
                message: "name, code and currency are required",
            });
        }

        code = code.toUpperCase().trim();
        currency = currency.toUpperCase().trim();

        const existing = await RegionModel.findOne({ code });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Region code already exists: ${code}`,
            });
        }

        const region = await RegionModel.create({
            name,
            code,
            currency,
            isActive,
            description,
        });

        res.status(201).json({
            success: true,
            region,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getRegions = async (req, res) => {
    try {
        const { page = 1, limit = 20, search = "", isActive } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { code: { $regex: search, $options: "i" } },
            ];
        }

        if (isActive !== undefined) {
            filter.isActive = isActive === "true";
        }

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const regions = await RegionModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        const total = await RegionModel.countDocuments(filter);

        res.json({
            success: true,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 0,
            },
            regions,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getSingleRegion = async (req, res) => {
    try {
        const region = await RegionModel.findById(req.params.id);
        if (!region) {
            return res.status(404).json({
                success: false,
                message: "Region not found",
            });
        }

        res.json({
            success: true,
            region,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateRegion = async (req, res) => {
    try {
        const region = await RegionModel.findById(req.params.id);
        if (!region) {
            return res.status(404).json({
                success: false,
                message: "Region not found",
            });
        }

        let { name, code, currency, isActive, description } = req.body;

        if (code) {
            code = code.toUpperCase().trim();
            const existing = await RegionModel.findOne({
                code,
                _id: { $ne: region._id },
            });
            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: `Region code already exists: ${code}`,
                });
            }
        }

        if (currency) {
            currency = currency.toUpperCase().trim();
        }

        const updated = await RegionModel.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    name: name ?? region.name,
                    code: code ?? region.code,
                    currency: currency ?? region.currency,
                    isActive: isActive ?? region.isActive,
                    description: description ?? region.description,
                },
            },
            { new: true }
        );

        res.json({
            success: true,
            region: updated,
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteRegion = async (req, res) => {
    try {
        const region = await RegionModel.findById(req.params.id);
        if (!region) {
            return res.status(404).json({
                success: false,
                message: "Region not found",
            });
        }

        const inUse = await ProductModel.exists({
            "variants.price.region": region._id,
        });

        if (inUse) {
            return res.status(400).json({
                success: false,
                message: "Region is in use by one or more products",
            });
        }

        await RegionModel.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: "Region deleted successfully",
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
