import mongoose from "mongoose";
import dotenv from "dotenv";
import CategoryModel from "../models/CategorySchema.js";
import ProductModel from "../models/ProductSchema.js";
import RegionModel from "../models/RegionSchema.js";

dotenv.config();

const MONGODB_URI = process.env.MONGO_URI;

// Seed data matching the frontend layout
const regions = [
  {
    code: "PK",
    name: "Pakistan",
    currency: "PKR",
    description: "Pakistan Region",
    isActive: true,
  },
  {
    code: "US",
    name: "United States",
    currency: "USD",
    description: "United States Region",
    isActive: true,
  },
  {
    code: "UK",
    name: "United Kingdom",
    currency: "GBP",
    description: "United Kingdom Region",
    isActive: true,
  },
];

const categories = [
  {
    name: "Totes",
    slug: "totes",
    image: "/Dummy/Home/CategoryImg.png",
    isActive: true,
  },
  {
    name: "Jewelry",
    slug: "jewelry",
    image: "/Dummy/Home/CategoryImg2.png",
    isActive: true,
  },
  {
    name: "Shoulder Bags",
    slug: "shoulder-bags",
    image: "/Dummy/Home/CategoryImg3.png",
    isActive: true,
  },
  {
    name: "Small Leather Goods",
    slug: "small-leather-goods",
    image: "/Dummy/Home/CategoryImg4.png",
    isActive: true,
  },
  {
    name: "Crossbody Bags",
    slug: "crossbody-bags",
    image: "/Dummy/Home/CategoryImg.png",
    isActive: true,
  },
  {
    name: "Backpacks",
    slug: "backpacks",
    image: "/Dummy/Home/CategoryImg2.png",
    isActive: true,
  },
];

// Products with variants matching the schema
const products = [
  {
    name: "Classic Leather Tote",
    slug: "classic-leather-tote",
    description:
      "Elegant and spacious leather tote perfect for everyday use. Crafted from premium full-grain leather with brass hardware.",
    badge: "Best Seller",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg.png", "/Dummy/Product/ProductImg2.png"],
    thumbnail: ["/Dummy/Product/ProductImg.png"],
    stock: 50,
  },
  {
    name: "Luxury Chain Shoulder Bag",
    slug: "luxury-chain-shoulder-bag",
    description:
      "Sophisticated shoulder bag with gold chain detail. Features quilted leather and multiple compartments.",
    badge: "Hot Sellers",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg2.png", "/Dummy/Product/ProductImg.png"],
    thumbnail: ["/Dummy/Product/ProductImg2.png"],
    stock: 35,
  },
  {
    name: "Vintage Crossbody Satchel",
    slug: "vintage-crossbody-satchel",
    description:
      "Compact crossbody bag with vintage-inspired design. Perfect for day-to-night styling.",
    badge: "New Arrival",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg.png", "/Dummy/Product/ProductImg2.png"],
    thumbnail: ["/Dummy/Product/ProductImg.png"],
    stock: 42,
  },
  {
    name: "Designer Gold Necklace",
    slug: "designer-gold-necklace",
    description:
      "Stunning 18k gold plated necklace with intricate design. A statement piece for any occasion.",
    badge: "Limited Edition",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg2.png", "/Dummy/Product/ProductImg.png"],
    thumbnail: ["/Dummy/Product/ProductImg2.png"],
    stock: 20,
  },
  {
    name: "Elegant Leather Wallet",
    slug: "elegant-leather-wallet",
    description:
      "Slim leather wallet with RFID protection. Multiple card slots and bill compartment.",
    badge: "Hot Sellers",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg.png", "/Dummy/Product/ProductImg2.png"],
    thumbnail: ["/Dummy/Product/ProductImg.png"],
    stock: 100,
  },
  {
    name: "Premium Tote Bag",
    slug: "premium-tote-bag",
    description:
      "Large capacity tote bag made from sustainable vegan leather. Eco-friendly and stylish.",
    badge: "Eco-Friendly",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg2.png", "/Dummy/Product/ProductImg.png"],
    thumbnail: ["/Dummy/Product/ProductImg2.png"],
    stock: 60,
  },
  {
    name: "Minimalist Shoulder Bag",
    slug: "minimalist-shoulder-bag",
    description:
      "Clean lines and modern design. Perfect for professionals who value simplicity.",
    badge: "Best Seller",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg.png", "/Dummy/Product/ProductImg2.png"],
    thumbnail: ["/Dummy/Product/ProductImg.png"],
    stock: 45,
  },
  {
    name: "Statement Pearl Earrings",
    slug: "statement-pearl-earrings",
    description:
      "Classic pearl earrings with a modern twist. Features freshwater pearls and gold accents.",
    badge: "Hot Sellers",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg2.png", "/Dummy/Product/ProductImg.png"],
    thumbnail: ["/Dummy/Product/ProductImg2.png"],
    stock: 30,
  },
  {
    name: "Versatile Backpack Tote",
    slug: "versatile-backpack-tote",
    description:
      "Convertible design that works as both a backpack and tote. Perfect for travel.",
    badge: "New Arrival",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg.png", "/Dummy/Product/ProductImg2.png"],
    thumbnail: ["/Dummy/Product/ProductImg.png"],
    stock: 55,
  },
  {
    name: "Luxury Leather Cardholder",
    slug: "luxury-leather-cardholder",
    description:
      "Ultra-slim cardholder crafted from Italian leather. Holds up to 8 cards.",
    badge: "Best Seller",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg2.png", "/Dummy/Product/ProductImg.png"],
    thumbnail: ["/Dummy/Product/ProductImg2.png"],
    stock: 80,
  },
  {
    name: "Chic Mini Crossbody",
    slug: "chic-mini-crossbody",
    description:
      "Compact crossbody perfect for essentials. Lightweight with adjustable strap.",
    badge: "Hot Sellers",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg.png", "/Dummy/Product/ProductImg2.png"],
    thumbnail: ["/Dummy/Product/ProductImg.png"],
    stock: 70,
  },
  {
    name: "Diamond Stud Set",
    slug: "diamond-stud-set",
    description:
      "Elegant diamond stud earrings set in white gold. Timeless and sophisticated.",
    badge: "Limited Edition",
    isVariable: true,
    images: ["/Dummy/Product/ProductImg2.png", "/Dummy/Product/ProductImg.png"],
    thumbnail: ["/Dummy/Product/ProductImg2.png"],
    stock: 15,
  },
];

// Color variants matching the frontend
const colorVariants = [
  {
    hex: "#000000",
    colorName: "Black",
    images: ["/Dummy/Product/ProductImg.png", "/Dummy/Product/ProductImg2.png"],
  },
  {
    hex: "#8B4513",
    colorName: "Brown",
    images: ["/Dummy/Product/ProductImg2.png", "/Dummy/Product/ProductImg.png"],
  },
  {
    hex: "#D2B48C",
    colorName: "Tan",
    images: ["/Dummy/Product/ProductImg.png", "/Dummy/Product/ProductImg2.png"],
  },
  {
    hex: "#C0C0C0",
    colorName: "Silver",
    images: ["/Dummy/Product/ProductImg2.png", "/Dummy/Product/ProductImg.png"],
  },
  {
    hex: "#FFD700",
    colorName: "Gold",
    images: ["/Dummy/Product/ProductImg.png", "/Dummy/Product/ProductImg2.png"],
  },
];

// Materials
const materials = [
  "Genuine Leather",
  "Vegan Leather",
  "Canvas",
  "Suede",
  "Nylon",
  "Polyester",
];

async function seedDatabase() {
  try {
    console.log("🌱 Starting database seeding...");

    // Connect to MongoDB with retry logic
    console.log("📡 Attempting to connect to MongoDB...");
    const connectionOptions = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGODB_URI, connectionOptions);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await CategoryModel.deleteMany({});
    await ProductModel.deleteMany({});
    await RegionModel.deleteMany({});
    console.log("✅ Existing data cleared");

    // Seed Regions
    console.log("📍 Seeding regions...");
    const createdRegions = await RegionModel.insertMany(regions);
    console.log(`✅ Created ${createdRegions.length} regions`);

    // Seed Categories
    console.log("📂 Seeding categories...");
    const createdCategories = await CategoryModel.insertMany(categories);
    console.log(`✅ Created ${createdCategories.length} categories`);

    // Seed Products with variants
    console.log("🛍️  Seeding products...");
    const productsWithCategories = products.map((product, index) => {
      // Assign 1-3 random categories to each product
      const numCategories = Math.floor(Math.random() * 3) + 1;
      const shuffled = [...createdCategories].sort(() => 0.5 - Math.random());
      const assignedCategories = shuffled
        .slice(0, numCategories)
        .map((cat) => cat._id);

      // Create variants with colors
      const numVariants = Math.floor(Math.random() * 2) + 1; // 1-2 variants per product
      const variants = [];

      for (let i = 0; i < numVariants; i++) {
        const material = materials[Math.floor(Math.random() * materials.length)];

        // Select 2-4 random colors for each variant
        const numColors = Math.floor(Math.random() * 3) + 2;
        const shuffledColors = [...colorVariants].sort(() => 0.5 - Math.random());
        const colors = shuffledColors.slice(0, numColors).map((color) => ({
          hex: {
            code: color.hex,
            colorName: color.colorName,
          },
          images: color.images,
        }));

        // Create region-specific pricing
        const basePrice = 8000 + Math.floor(Math.random() * 40000); // 8k-48k PKR
        const regionPrices = createdRegions.map((region) => {
          let price = basePrice;

          // Adjust price based on region
          if (region.code === "US") {
            price = Math.round(basePrice / 280); // PKR to USD
          } else if (region.code === "UK") {
            price = Math.round(basePrice / 350); // PKR to GBP
          }

          // Random discount (20%-50% off)
          const discountPercentage = Math.floor(Math.random() * 30) + 20;

          return {
            region: region._id,
            price: price,
            discountMode: "percentage",
            discountValue: discountPercentage,
          };
        });

        variants.push({
          material,
          price: regionPrices,
          colors,
        });
      }

      // Create pricing for non-variable products
      const basePrice = 8000 + Math.floor(Math.random() * 40000);
      const pricing = createdRegions.map((region) => {
        let price = basePrice;

        if (region.code === "US") {
          price = Math.round(basePrice / 280);
        } else if (region.code === "UK") {
          price = Math.round(basePrice / 350);
        }

        const discountPercentage = Math.floor(Math.random() * 30) + 20;

        return {
          region: region._id,
          price: price,
          discountMode: "percentage",
          discountValue: discountPercentage,
        };
      });

      return {
        ...product,
        categories: assignedCategories,
        variants,
        pricing,
      };
    });

    const createdProducts = await ProductModel.insertMany(
      productsWithCategories
    );
    console.log(`✅ Created ${createdProducts.length} products`);

    // Display summary
    console.log("\n📊 Seeding Summary:");
    console.log(`   Regions: ${createdRegions.length}`);
    console.log(`   Categories: ${createdCategories.length}`);
    console.log(`   Products: ${createdProducts.length}`);

    console.log("\n✨ Database seeding completed successfully!");

    // Sample product output
    console.log("\n📦 Sample Product:");
    const sampleProduct = await ProductModel.findOne({})
      .populate("categories")
      .populate("variants.price.region")
      .populate("pricing.region");
    console.log(JSON.stringify(sampleProduct, null, 2));
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n👋 Database connection closed");
  }
}

// Run the seed function
seedDatabase();
