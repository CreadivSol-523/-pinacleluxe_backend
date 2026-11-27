// Sirf apne Cloudinary ke links allow, koi random URL save nahi hoga
const PREFIX = process.env.CLOUDINARY_CLOUD_NAME ? `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/` : "https://res.cloudinary.com/";

export const assertCloudinaryUrl = (u) => {
   if (typeof u !== "string" || !u.startsWith(PREFIX)) {
      const err = new Error("Invalid image URL");
      err.status = 400;
      throw err;
   }
   return u;
};

export const parseUrlList = (value) => {
   if (value == null || value === "") return [];
   let list = value;
   if (typeof value === "string") {
      try {
         list = JSON.parse(value);
      } catch {
         const err = new Error("productImages must be valid JSON");
         err.status = 400;
         throw err;
      }
   }
   if (!Array.isArray(list)) {
      const err = new Error("productImages must be an array");
      err.status = 400;
      throw err;
   }
   return list.map(assertCloudinaryUrl);
};
