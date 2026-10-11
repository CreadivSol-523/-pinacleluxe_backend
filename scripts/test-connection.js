import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

console.log("🔍 Testing MongoDB Connection...");
console.log("📍 URI:", MONGO_URI ? MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') : "NOT FOUND");

async function testConnection() {
  try {
    console.log("\n⏳ Attempting connection (30s timeout)...");

    const options = {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGO_URI, options);

    console.log("✅ Successfully connected to MongoDB!");
    console.log("📊 Connection details:");
    console.log("   - Host:", mongoose.connection.host);
    console.log("   - Database:", mongoose.connection.name);
    console.log("   - Ready State:", mongoose.connection.readyState);

    // Test a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`   - Collections: ${collections.length} found`);

    await mongoose.connection.close();
    console.log("\n✅ Connection test passed!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Connection failed!");
    console.error("Error:", error.message);

    if (error.message.includes("ESERVFAIL")) {
      console.log("\n💡 DNS resolution failed. Possible causes:");
      console.log("   1. Network/DNS issues");
      console.log("   2. Using mobile data with DNS restrictions");
      console.log("   3. ISP blocking MongoDB Atlas");
    } else if (error.message.includes("ETIMEDOUT") || error.message.includes("ECONNREFUSED")) {
      console.log("\n💡 Connection timeout. Possible causes:");
      console.log("   1. Your IP is not whitelisted in MongoDB Atlas");
      console.log("   2. Firewall blocking outbound connections");
      console.log("   3. MongoDB cluster is paused or deleted");
    } else if (error.message.includes("Authentication failed")) {
      console.log("\n💡 Authentication error. Check:");
      console.log("   1. Username and password in connection string");
      console.log("   2. Database user exists in MongoDB Atlas");
    }

    console.log("\n📋 Quick fixes to try:");
    console.log("   1. Go to: https://cloud.mongodb.com");
    console.log("   2. Navigate to: Network Access");
    console.log("   3. Add IP: 0.0.0.0/0 (allow all - for testing)");
    console.log("   4. Check if cluster is active (not paused)");

    process.exit(1);
  }
}

testConnection();
