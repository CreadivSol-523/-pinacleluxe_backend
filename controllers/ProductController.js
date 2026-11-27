import ProductModel from "../models/ProductSchema.js";
import CategoryModel from "../models/CategorySchema.js";
import slugify from "slugify";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import RegionModel from "../models/RegionSchema.js";
import { buildProcessedVariants, buildProcessedVariantsForUpdate, buildVariantsFromUrls, collectVariantImageUrls, destroyCloudinaryUrls, uploadMany } from "../utils/ProductUploadHelpers.js";
import { assertCloudinaryUrl, parseUrlList } from "../utils/cloudinaryUrl.js";

// Regex special chars escape (ReDoS / injection se bachne ke liye)
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Category lookup cache (production mein Redis better hai)
const categoryCache = new Map();
const CATEGORY_TTL = 5 * 60 * 1000; // 5 min

const resolveCategoryId = async (category) => {
   if (mongoose.Types.ObjectId.isValid(category)) return category;

   const cached = categoryCache.get(category);
   if (cached && cached.expires > Date.now()) return cached.id;

   const foundCategory = await CategoryModel.findOne({
      $or: [{ slug: category }, { name: { $regex: new RegExp(`^${escapeRegex(category)}$`, "i") } }],
   })
      .select("_id")
      .lean();

   if (!foundCategory) return null;

   categoryCache.set(category, { id: foundCategory._id, expires: Date.now() + CATEGORY_TTL });
   return foundCategory._id;
};

// Region lookup cache (regionCode -> region doc)
const regionCache = new Map();
const REGION_TTL = 5 * 60 * 1000; // 5 min

const resolveRegionByCode = async (regionCode) => {
   const code = String(regionCode).trim().toUpperCase();

   const cached = regionCache.get(code);
   if (cached && cached.expires > Date.now()) return cached.region;

   const region = await RegionModel.findOne({ code }).select("name code currency").lean();

   // not-found bhi cache hoga taake bar bar DB hit na ho
   regionCache.set(code, { region: region || null, expires: Date.now() + REGION_TTL });
   return region || null;
};

export const getProducts = async (req, res, next) => {
   try {
      const { search = "", category, isActive, regionCode } = req.query;

      // Page/limit sanitize + limit pe cap
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

      const query = {};

      if (search) {
         if (typeof search === "object") {
            if (search.badge) {
               query.badge = { $regex: escapeRegex(search.badge), $options: "i" };
            }
            if (search.material) {
               query["variants.material"] = { $regex: escapeRegex(search.material), $options: "i" };
            }
            if (search.color) {
               query["variants.colors.hex.colorName"] = { $regex: escapeRegex(search.color), $options: "i" };
            }
         } else {
            query.name = { $regex: escapeRegex(search), $options: "i" };
         }
      }

      if (category) {
         const catId = await resolveCategoryId(String(category));
         if (!catId) {
            return res.status(404).json({
               success: false,
               message: `Category not found: ${category}`,
            });
         }
         query.$or = [{ category: catId }, { categories: catId }];
      }

      if (isActive !== undefined) {
         query.isActive = isActive === "true";
      }

      // ---------- Region filter ----------
      // regionCode aaye to sirf wohi products jinme us region ki price ho
      let region = null;
      if (regionCode && typeof regionCode === "string") {
         region = await resolveRegionByCode(regionCode);

         if (!region) {
            // Is code ka koi region hi nahi -> koi product nahi dikhega
            return res.status(200).json({
               success: true,
               total: 0,
               page,
               pages: 0,
               pagination: { total: 0, page, pages: 0, limit },
               products: [],
            });
         }

         // category ka $or already use ho raha hai, isliye $and mein daala
         query.$and = [
            {
               $or: [{ "pricing.region": region._id }, { "variants.price.region": region._id }],
            },
         ];
      }

      const skip = (page - 1) * limit;

      let productsQuery = ProductModel.find(query).populate("categories", "name slug").populate("categories", "name slug").populate("accessories");

      // Region ke bina: pehle jesa populate. Region ke sath: populate ki zaroorat nahi,
      // kyunke region doc hamare paas already hai (neeche attach hoga)
      if (!region) {
         productsQuery = productsQuery.populate("pricing.region", "name code currency").populate("variants.price.region", "name code currency");
      }

      // find + count parallel chalenge
      const [rawProducts, total] = await Promise.all([productsQuery.sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), ProductModel.countDocuments(query)]);

      let products = rawProducts;

      // Sirf us country ka region/price dikhao
      if (region) {
         const regionId = String(region._id);

         products = rawProducts.map((p) => {
            const pricing = (p.pricing || []).filter((x) => String(x.region) === regionId).map((x) => ({ ...x, region }));

            const variants = (p.variants || [])
               .map((v) => ({
                  ...v,
                  price: (v.price || []).filter((x) => String(x.region) === regionId).map((x) => ({ ...x, region })),
               }))
               // jis variant ki is region mein price nahi, wo is country ke liye available nahi
               .filter((v) => v.price.length > 0);

            return { ...p, pricing, variants };
         });
      }

      const pages = Math.ceil(total / limit);

      // Response ab region pe depend karta hai, cache karo to key mein regionCode zaroor rakho
      // res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");

      res.status(200).json({
         success: true,
         total,
         page,
         pages,
         pagination: {
            total,
            page,
            pages,
            limit,
         },
         products,
      });
   } catch (error) {
      next(error);
   }
};

// export const getProducts = async (req, res, next) => {
//     try {
//         const { page = 1, limit = 10, search = "", category, isActive } = req.query;
//         const query = {};

//         if (search) {
//             if (typeof search === 'object') {
//                 if (search.badge) {
//                     query.badge = { $regex: search.badge, $options: "i" };
//                 }
//                 if (search.material) {
//                     query["variants.material"] = { $regex: search.material, $options: "i" };
//                 }
//                 if (search.color) {
//                     query["variants.colors.hex.colorName"] = { $regex: search.color, $options: "i" };
//                 }
//             } else {
//                 query.name = { $regex: search, $options: "i" };
//             }
//         }
//         if (category) {
//             let catId = category;
//             if (!mongoose.Types.ObjectId.isValid(category)) {
//                 const foundCategory = await CategoryModel.findOne({
//                     $or: [
//                         { slug: category },
//                         { name: { $regex: new RegExp(`^${category}$`, "i") } }
//                     ]
//                 });
//                 if (foundCategory) {
//                     catId = foundCategory._id;
//                 } else {
//                     return res.status(404).json({
//                         success: false,
//                         message: `Category not found: ${category}`
//                     });
//                 }
//             }
//             query.$or = [
//                 { category: catId },
//                 { categories: catId }
//             ];
//         }
//         if (isActive !== undefined) {
//             query.isActive = isActive === "true";
//         }

//         const skip = (Number(page) - 1) * Number(limit);
//         const products = await ProductModel.find(query)
//             .populate("category", "name slug")
//             .populate("categories", "name slug")
//             .populate("accessories")
//             .populate("pricing.region", "name code currency")
//             .skip(skip)
//             .limit(Number(limit))
//             .sort({ createdAt: -1 });

//         const total = await ProductModel.countDocuments(query);

//         res.status(200).json({
//             success: true,
//             total,
//             page: Number(page),
//             pages: Math.ceil(total / Number(limit)),
//             pagination: {
//                 total,
//                 page: Number(page),
//                 pages: Math.ceil(total / Number(limit)),
//                 limit: Number(limit)
//             },
//             products,
//         });
//     } catch (error) {
//         next(error);
//     }
// };

// Get product filters (badges, colors, materials)
export const getProductFilters = async (req, res, next) => {
   try {
      const { category } = req.query;
      const query = {};

      if (category) {
         let catId = category;
         if (!mongoose.Types.ObjectId.isValid(category)) {
            const foundCategory = await CategoryModel.findOne({
               $or: [{ slug: category }, { name: { $regex: new RegExp(`^${category}$`, "i") } }],
            });
            if (foundCategory) {
               catId = foundCategory._id;
            }
         }
         if (mongoose.Types.ObjectId.isValid(catId)) {
            query.$or = [{ category: catId }, { categories: catId }];
         }
      }

      const products = await ProductModel.find(query).select("badge variants");

      const badgesSet = new Set();
      const colorsSet = new Set();
      const materialsSet = new Set();

      products.forEach((p) => {
         if (p.badge) badgesSet.add(p.badge);
         if (p.variants && Array.isArray(p.variants)) {
            p.variants.forEach((v) => {
               if (v.material) materialsSet.add(v.material);
               if (v.colors && Array.isArray(v.colors)) {
                  v.colors.forEach((c) => {
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
         },
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
      const products = await ProductModel.find(query).select("name price pricing images sku stock").populate("pricing.region", "name code currency").skip(skip).limit(Number(limit)).sort({ name: 1 });

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
            limit: Number(limit),
         },
         products,
      });
   } catch (error) {
      next(error);
   }
};

// Get single product with region pricing and accessories populated (supports lookup by _id or slug)
// export const getSingleProduct = async (req, res, next) => {
//    try {
//       const identifier = req.params.id;
//       let product;

//       if (mongoose.Types.ObjectId.isValid(identifier)) {
//          product = await ProductModel.findById(identifier);
//       } else {
//          product = await ProductModel.findOne({ slug: identifier });
//       }

//       if (!product) {
//          return res.status(404).json({ success: false, message: "Product not found" });
//       }

//       // Populate references
//       await product.populate([{ path: "categories", select: "name slug" }, { path: "accessories" }, { path: "pricing.region", select: "name code currency" }]);

//       res.status(200).json({ success: true, product });
//    } catch (error) {
//       next(error);
//    }
// };

export const getSingleProduct = async (req, res, next) => {
   try {
      const identifier = req.params.id;
      const regionCode = typeof req.query.regionCode === "string" ? req.query.regionCode.trim().toUpperCase() : "";

      let product;

      if (mongoose.Types.ObjectId.isValid(identifier)) {
         product = await ProductModel.findById(identifier);
      } else {
         product = await ProductModel.findOne({ slug: identifier });
      }

      if (!product) {
         return res.status(404).json({
            success: false,
            message: "Product not found",
         });
      }

      await product.populate([
         { path: "categories", select: "name slug" },
         { path: "accessories", select: "name slug _id thumbnail pricing variants" },
         { path: "pricing.region", select: "name code currency" },
         { path: "variants.price.region", select: "name code currency" },
      ]);

      const result = product.toObject();

      // regionCode aaye to filter, lekin match na mile to saara original price rakho
      if (regionCode) {
         const matchRegion = (item) => item.region?.code?.toUpperCase() === regionCode;

         const filterWithFallback = (list = []) => {
            const matched = list.filter(matchRegion);
            return matched.length > 0 ? matched : list;
         };

         result.pricing = filterWithFallback(result.pricing);

         result.variants = (result.variants ?? []).map((variant) => ({
            ...variant,
            price: filterWithFallback(variant.price),
         }));
      }

      res.status(200).json({
         success: true,
         product: result,
      });
   } catch (error) {
      next(error);
   }
};

// Create product with stock management, accessories, and regional pricing
// export const createProduct = async (req, res) => {
//    try {
//       let { name, description, categories, badge, isVariable, pricing, variants, stock, accessories } = req.body;

//       if (!name) {
//          return res.status(400).json({
//             success: false,
//             message: "Name is required",
//          });
//       }

//       if (typeof categories === "string") {
//          categories = JSON.parse(categories);
//       }

//       if (!Array.isArray(categories) || categories.length === 0) {
//          return res.status(400).json({
//             success: false,
//             message: "categories must be a non-empty array",
//          });
//       }

//       //   if (accessories.length > 0 && !Array.isArray(accessories)) {
//       //      return res.status(400).json({
//       //         success: false,
//       //         message: "accessories must be in array",
//       //      });
//       //   }

//       const existingCategories = await CategoryModel.find({
//          _id: { $in: categories },
//       });

//       if (existingCategories.length !== categories.length) {
//          return res.status(400).json({
//             success: false,
//             message: "Invalid categories",
//          });
//       }

//       if (typeof pricing === "string") {
//          pricing = JSON.parse(pricing);
//       }

//       if (pricing != null && !Array.isArray(pricing)) {
//          return res.status(400).json({
//             success: false,
//             message: "pricing must be an array",
//          });
//       }
//       if (isVariable === false && (!pricing || pricing.length === 0)) {
//          return res.status(400).json({
//             success: false,
//             message: "Non-variable products must include pricing",
//          });
//       }

//       // Validate and resolve top-level pricing region references to ObjectIds
//       if (Array.isArray(pricing) && pricing.length > 0) {
//          const processedPricing = [];
//          for (const entry of pricing) {
//             const { region: regionRef, price: regionPrice, discountMode, discountValue } = entry || {};
//             console.log(regionRef);
//             if (!regionRef || regionPrice == null) {
//                return res.status(400).json({
//                   success: false,
//                   message: "Each pricing entry must include region and price",
//                });
//             }

//             let region;
//             if (mongoose.Types.ObjectId.isValid(regionRef)) {
//                region = await RegionModel.findById(regionRef);
//             } else if (typeof regionRef === "string") {
//                region = await RegionModel.findOne({ code: regionRef.toUpperCase().trim() });
//             }

//             if (!region) {
//                return res.status(400).json({
//                   success: false,
//                   message: `Region not found: ${regionRef}`,
//                });
//             }

//             processedPricing.push({
//                region: region._id,
//                price: Number(regionPrice),
//                discountMode,
//                discountValue: discountValue || 0,
//             });
//          }

//          pricing = processedPricing;
//       }

//       if (typeof variants === "string") {
//          variants = JSON.parse(variants);
//       }

//       if (!Array.isArray(variants)) {
//          return res.status(400).json({
//             success: false,
//             message: "variants must be an array",
//          });
//       }

//       let processedVariants;
//       try {
//          processedVariants = await buildProcessedVariants(variants, req.files);
//       } catch (e) {
//          const status = e.status || 500;
//          return res.status(status).json({
//             success: false,
//             message: e.message,
//          });
//       }

//       const images = await uploadMany(req.files?.productImages, "products");
//       const thumbnails = await uploadMany(req.files?.thumbnails || req.files?.thumbnail, "products/thumbnails");

//       const slug = slugify(name, { lower: true, strict: true });

//       let uniqueSlug = slug;
//       let count = 1;

//       while (await ProductModel.findOne({ slug: uniqueSlug })) {
//          uniqueSlug = `${slug}-${count++}`;
//       }

//       const product = await ProductModel.create({
//          name,
//          slug: uniqueSlug,
//          description,
//          categories,
//          accessories,
//          badge,
//          isVariable,
//          pricing,
//          variants: processedVariants,
//          stock,
//          images,
//          thumbnail: thumbnails,
//       });

//       res.status(201).json({
//          success: true,
//          product,
//       });
//    } catch (error) {
//       res.status(500).json({
//          success: false,
//          error: error.message,
//       });
//    }
// };
export const createProduct = async (req, res) => {
   try {
      let { name, description, categories, badge, isVariable, pricing, variants, stock, accessories, thumbnail, productImages } = req.body;

      if (!name) {
         return res.status(400).json({ success: false, message: "Name is required" });
      }

      if (typeof categories === "string") categories = JSON.parse(categories);

      if (!Array.isArray(categories) || categories.length === 0) {
         return res.status(400).json({ success: false, message: "categories must be a non-empty array" });
      }

      const existingCategories = await CategoryModel.find({ _id: { $in: categories } });
      if (existingCategories.length !== categories.length) {
         return res.status(400).json({ success: false, message: "Invalid categories" });
      }

      if (typeof pricing === "string") pricing = JSON.parse(pricing);

      if (pricing != null && !Array.isArray(pricing)) {
         return res.status(400).json({ success: false, message: "pricing must be an array" });
      }

      const variable = isVariable === true || isVariable === "true";

      if (!variable && (!pricing || pricing.length === 0)) {
         return res.status(400).json({ success: false, message: "Non-variable products must include pricing" });
      }

      if (Array.isArray(pricing) && pricing.length > 0) {
         const processedPricing = [];
         for (const entry of pricing) {
            const { region: regionRef, price: regionPrice, discountMode, discountValue } = entry || {};
            if (!regionRef || regionPrice == null) {
               return res.status(400).json({ success: false, message: "Each pricing entry must include region and price" });
            }

            let region;
            if (mongoose.Types.ObjectId.isValid(regionRef)) {
               region = await RegionModel.findById(regionRef);
            } else if (typeof regionRef === "string") {
               region = await RegionModel.findOne({ code: regionRef.toUpperCase().trim() });
            }

            if (!region) {
               return res.status(400).json({ success: false, message: `Region not found: ${regionRef}` });
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

      if (typeof variants === "string") variants = JSON.parse(variants);

      if (!Array.isArray(variants)) {
         return res.status(400).json({ success: false, message: "variants must be an array" });
      }

      // ── Variants ab URLs se (req.files ki zaroorat nahi) ──
      const processedVariants = await buildVariantsFromUrls(variants);

      const images = parseUrlList(productImages);
      const thumbnails = [assertCloudinaryUrl(thumbnail)];

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
         accessories,
         badge,
         isVariable: variable,
         pricing,
         variants: processedVariants,
         stock,
         images,
         thumbnail: thumbnails,
      });

      res.status(201).json({ success: true, product });
   } catch (error) {
      res.status(error.status || 500).json({ success: false, message: error.message });
   }
};

// Update product
export const updateProduct = async (req, res) => {
   try {
      const updateData = { ...req.body };
      delete updateData.images;
      delete updateData.thumbnail;

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

         const invalidIds = updateData.categories.filter((id) => !mongoose.Types.ObjectId.isValid(id));

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
         console.log(updateData.variants[0]);
         try {
            updateData.variants = await buildProcessedVariantsForUpdate(updateData.variants, req.files, product.variants);
         } catch (e) {
            const status = e.status || 400;
            return res.status(status).json({
               success: false,
               message: e.message,
            });
         }

         const newVariantUrlSet = new Set(collectVariantImageUrls(updateData.variants));
         await destroyCloudinaryUrls(oldVariantUrls.filter((u) => !newVariantUrlSet.has(u)));
      }

      if (req.files?.productImages) {
         const newProductImages = await uploadMany(req.files.productImages, "products");
         if (newProductImages.length > 0) {
            await destroyCloudinaryUrls(product.images || []);
            updateData.images = newProductImages;
         }
      }

      if (req.files?.thumbnails || req.files?.thumbnail) {
         const newThumbnails = await uploadMany(req.files.thumbnails || req.files.thumbnail, "products/thumbnails");
         if (newThumbnails.length > 0) {
            await destroyCloudinaryUrls(product.thumbnail || []);
            updateData.thumbnail = newThumbnails;
         }
      }

      const updated = await ProductModel.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });

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

// Bulk Delete Products
export const bulkDeleteProducts = async (req, res, next) => {
   try {
      const { ids } = req.body;
      console.log(ids);
      if (!Array.isArray(ids) || ids.length === 0) {
         return res.status(400).json({
            success: false,
            message: "Please provide product IDs",
         });
      }

      const objectIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));

      const slugs = ids.filter((id) => !mongoose.Types.ObjectId.isValid(id));

      const query = [];

      if (objectIds.length) {
         query.push({ _id: { $in: objectIds } });
      }

      if (slugs.length) {
         query.push({ slug: { $in: slugs } });
      }

      const result = await ProductModel.deleteMany({
         $or: query,
      });

      return res.status(200).json({
         success: true,
         message: `${result.deletedCount} products deleted successfully`,
         deletedCount: result.deletedCount,
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
