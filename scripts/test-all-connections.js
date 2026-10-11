import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

console.log("🔍 Testing Alternative Connection Strings...\n");

const connectionStrings = [
  {
    name: "Original SRV",
    uri: process.env.MONGO_URI
  },
  {
    name: "Standard (no SRV) - Replica Set",
    uri: "mongodb://wasif:wasif@cluster0-shard-00-00.fmaocsf.mongodb.net:27017,cluster0-shard-00-01.fmaocsf.mongodb.net:27017,cluster0-shard-00-02.fmaocsf.mongodb.net:27017/thomas_logistics_fiver?ssl=true&replicaSet=atlas-12e9zu-shard-0&authSource=admin&retryWrites=true&w=majority"
  },
  {
    name: "Standard (no SRV) - Single Node",
    uri: "mongodb://wasif:wasif@cluster0.fmaocsf.mongodb.net:27017/thomas_logistics_fiver?ssl=true&authSource=admin&retryWrites=true&w=majority"
  }
];

async function testConnections() {
  for (const conn of connectionStrings) {
    console.log(`\n📡 Testing: ${conn.name}`);
    console.log(`URI: ${conn.uri.substring(0, 50)}...`);

    try {
      const options = {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      };

      await mongoose.connect(conn.uri, options);

      console.log("✅ SUCCESS! This connection string works!");
      console.log(`\n🎉 Use this connection string in your .env file:\n`);
      console.log(`MONGO_URI=${conn.uri}\n`);

      await mongoose.connection.close();
      process.exit(0);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    }
  }

  console.log("\n\n❌ All connection attempts failed!");
  console.log("\n💡 Alternative Solutions:");
  console.log("\n1. USE LOCAL MONGODB (Recommended for development):");
  console.log("   - Download: https://www.mongodb.com/try/download/community");
  console.log("   - Install and start MongoDB service");
  console.log("   - Update .env: MONGO_URI=mongodb://localhost:27017/pinacleluxe");
  console.log("\n2. CREATE NEW MONGODB ATLAS CLUSTER:");
  console.log("   - Go to: https://cloud.mongodb.com");
  console.log("   - Create new M0 (free) cluster");
  console.log("   - Whitelist all IPs (0.0.0.0/0)");
  console.log("   - Get new connection string");
  console.log("\n3. USE MONGODB.COM SHARED HOSTING:");
  console.log("   - Try MongoDB Atlas with different DNS servers");
  console.log("   - Change Windows DNS to 8.8.8.8 (Google DNS)");

  process.exit(1);
}

testConnections();
