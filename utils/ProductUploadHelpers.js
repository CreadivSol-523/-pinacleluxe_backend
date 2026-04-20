import { v2 as cloudinary } from "cloudinary";

// Images: only req.files — field names: productImages, v{variantIndex}_c{colorIndex}

function listifyFiles(fileOrArray) {
    if (!fileOrArray) return [];
    return Array.isArray(fileOrArray) ? fileOrArray : [fileOrArray];
}

export async function uploadMany(fileOrArray, folder) {
    const urls = [];
    for (const file of listifyFiles(fileOrArray)) {
        if (!file?.tempFilePath) continue;
        const result = await cloudinary.uploader.upload(file.tempFilePath, {
            folder,
        });
        urls.push(result.secure_url);
    }
    return urls;
}

function publicIdFromSecureUrl(url) {
    if (!url || typeof url !== "string") return null;
    const marker = "/upload/";
    const i = url.indexOf(marker);
    if (i === -1) return null;
    let rest = url.slice(i + marker.length);
    rest = rest.replace(/^v\d+\//, "");
    const lastDot = rest.lastIndexOf(".");
    const lastSlash = rest.lastIndexOf("/");
    if (lastDot > lastSlash) rest = rest.slice(0, lastDot);
    return rest || null;
}

function isCloudinaryUrl(url) {
    return typeof url === "string" && url.includes("cloudinary.com");
}

export async function destroyCloudinaryUrls(urls) {
    for (const url of urls) {
        if (!isCloudinaryUrl(url)) continue;
        const publicId = publicIdFromSecureUrl(url);
        if (publicId) {
            await cloudinary.uploader.destroy(publicId).catch(() => { });
        }
    }
}

export function collectVariantImageUrls(variants) {
    const urls = [];
    for (const v of variants || []) {
        for (const c of v.colors || []) {
            for (const u of c.images || []) {
                if (u) urls.push(u);
            }
        }
    }
    return urls;
}

export function collectProductImageUrls(doc) {
    return [...(doc.images || []), ...collectVariantImageUrls(doc.variants)];
}

export async function buildProcessedVariants(variants, files) {
    const processedVariants = [];

    for (let vi = 0; vi < variants.length; vi++) {
        const variant = variants[vi];
        const { material, price, colors } = variant;

        if (!material || !price) {
            throw Object.assign(
                new Error("Each variant must have material and price"),
                { status: 400 }
            );
        }

        if (colors != null && !Array.isArray(colors)) {
            throw Object.assign(new Error("colors must be an array"), {
                status: 400,
            });
        }

        const processedColors = [];

        if (Array.isArray(colors)) {
            for (let ci = 0; ci < colors.length; ci++) {
                const color = colors[ci];
                const { hex } = color;
                const fieldKey = `v${vi}_c${ci}`;
                const images = await uploadMany(
                    files?.[fieldKey],
                    "products/variants"
                );
                processedColors.push({
                    hex,
                    images,
                });
            }
        }

        processedVariants.push({
            material,
            price,
            colors: processedColors,
        });
    }

    return processedVariants;
}

/** Update: keep existing color images when no new files for that slot; new files replace that slot only. */
export async function buildProcessedVariantsForUpdate(
    variants,
    files,
    previousVariants
) {
    const prev = previousVariants || [];
    const processedVariants = [];

    for (let vi = 0; vi < variants.length; vi++) {
        const variant = variants[vi];
        const { material, price, colors } = variant;

        if (!material || !price) {
            throw Object.assign(
                new Error("Each variant must have material and price"),
                { status: 400 }
            );
        }

        if (colors != null && !Array.isArray(colors)) {
            throw Object.assign(new Error("colors must be an array"), {
                status: 400,
            });
        }

        const processedColors = [];

        if (Array.isArray(colors)) {
            for (let ci = 0; ci < colors.length; ci++) {
                const color = colors[ci];
                const { hex } = color;
                const fieldKey = `v${vi}_c${ci}`;
                const uploaded = await uploadMany(
                    files?.[fieldKey],
                    "products/variants"
                );
                const preserved =
                    prev[vi]?.colors?.[ci]?.images?.filter(Boolean) ?? [];
                const images =
                    uploaded.length > 0 ? uploaded : [...preserved];
                processedColors.push({ hex, images });
            }
        }

        processedVariants.push({
            material,
            price,
            colors: processedColors,
        });
    }

    return processedVariants;
}
