import mongoose from "mongoose";
import dns from "dns";

// Custom DNS servers
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// Override DNS lookup to handle SRV records
const originalLookup = dns.lookup;
const originalResolveSrv = dns.resolveSrv;

// Patch DNS methods
dns.resolveSrv = (hostname, callback) => {
   console.log(`SRV lookup for: ${hostname}`);

   if (hostname === "_mongodb._tcp.cluster0.fmaocsf.mongodb.net") {
      // Manual SRV response
      const mockSrvRecords = [
         {
            name: "cluster0-shard-00-00.fmaocsf.mongodb.net",
            port: 27017,
            priority: 10,
            weight: 1,
         },
         {
            name: "cluster0-shard-00-01.fmaocsf.mongodb.net",
            port: 27017,
            priority: 10,
            weight: 1,
         },
         {
            name: "cluster0-shard-00-02.fmaocsf.mongodb.net",
            port: 27017,
            priority: 10,
            weight: 1,
         },
      ];
      callback(null, mockSrvRecords);
   } else {
      originalResolveSrv(hostname, callback);
   }
};

const connectDB = async () => {
   try {
      // Ab SRV wala connection string bhi kaam karega
      await mongoose.connect(process.env.MONGO_URI, {
         serverSelectionTimeoutMS: 10000,
         family: 4,
      });

      console.log("✅ Database Connected");
   } catch (err) {
      console.error("❌ Error:", err.message);
      process.exit(1);
   }
};

export default connectDB;
