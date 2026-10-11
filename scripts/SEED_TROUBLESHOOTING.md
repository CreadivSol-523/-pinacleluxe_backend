# Database Seeding Troubleshooting Guide

## Current Issue
The seeding script is encountering a DNS/network connectivity issue with MongoDB Atlas:
```
Error: querySrv ESERVFAIL _mongodb._tcp.cluster0.fmaocsf.mongodb.net
```

## Solutions

### Option 1: Fix MongoDB Atlas Connectivity

1. **Check IP Whitelist**
   - Go to MongoDB Atlas Dashboard
   - Navigate to Network Access
   - Add your current IP address or use `0.0.0.0/0` for testing (not recommended for production)

2. **Verify Cluster Status**
   - Check if the cluster is running (not paused)
   - MongoDB Atlas pauses free-tier clusters after 60 days of inactivity

3. **Check DNS Resolution**
   ```bash
   nslookup cluster0.fmaocsf.mongodb.net
   ```

4. **Update Connection String**
   - If cluster was recreated, update `MONGO_URI` in `.env`

5. **Test Connection**
   ```bash
   npm run seed
   ```

### Option 2: Use Alternative Connection String

Try the standard connection format instead of SRV:
```
MONGO_URI=mongodb://wasif:wasif@cluster0-shard-00-00.fmaocsf.mongodb.net:27017,cluster0-shard-00-01.fmaocsf.mongodb.net:27017,cluster0-shard-00-02.fmaocsf.mongodb.net:27017/thomas_logistics_fiver?ssl=true&replicaSet=atlas-xxxxx-shard-0&authSource=admin&retryWrites=true&w=majority
```

### Option 3: Use Local MongoDB

1. **Install MongoDB Community Server**
   - Download from: https://www.mongodb.com/try/download/community
   - Install and start the service

2. **Update .env**
   ```
   MONGO_URI=mongodb://localhost:27017/pinacleluxe
   ```

3. **Run seed script**
   ```bash
   npm run seed
   ```

### Option 4: Create New MongoDB Atlas Cluster

1. Go to https://cloud.mongodb.com/
2. Create a new free cluster
3. Create a database user
4. Whitelist your IP (0.0.0.0/0 for testing)
5. Get the connection string
6. Update `MONGO_URI` in `.env`
7. Run seed script

## Seed Data Structure

The seed script creates:
- **3 Regions**: Pakistan (PKR), United States (USD), United Kingdom (GBP)
- **6 Categories**: Totes, Jewelry, Shoulder Bags, Small Leather Goods, Crossbody Bags, Backpacks
- **12 Products**: Each with multiple variants, colors, and region-specific pricing

### Product Features:
- Multiple material variants (Genuine Leather, Vegan Leather, Canvas, Suede, Nylon, Polyester)
- 2-4 color options per variant (Black, Brown, Tan, Silver, Gold)
- Region-specific pricing with automatic currency conversion
- Discount percentages (20-50% off)
- Product images from frontend `/Dummy/Product/` directory
- Badges: "Best Seller", "Hot Sellers", "New Arrival", "Limited Edition", "Eco-Friendly"

## Running the Seed Script

Once MongoDB connection is working:

```bash
npm run seed
```

Expected output:
```
🌱 Starting database seeding...
📡 Attempting to connect to MongoDB...
✅ Connected to MongoDB
🗑️  Clearing existing data...
✅ Existing data cleared
📍 Seeding regions...
✅ Created 3 regions
📂 Seeding categories...
✅ Created 6 categories
🛍️  Seeding products...
✅ Created 12 products

📊 Seeding Summary:
   Regions: 3
   Categories: 6
   Products: 12

✨ Database seeding completed successfully!
```

## Manual Import (Alternative)

If the seed script continues to fail, you can manually import the data using MongoDB Compass or mongoimport:

1. **Using MongoDB Compass**:
   - Connect to your database
   - Import `scripts/seed-data.json` to respective collections

2. **Using mongoimport**:
   ```bash
   mongoimport --uri="your_mongo_uri" --collection=regions --file=scripts/seed-data.json --jsonArray
   ```

## API Endpoints to Verify Seeding

After successful seeding, test these endpoints:

```bash
# Get all regions
GET http://localhost:5000/api/regions

# Get all categories
GET http://localhost:5000/api/categories

# Get all products
GET http://localhost:5000/api/products

# Get products by category
GET http://localhost:5000/api/products?category=totes
```

## Common Issues

1. **Authentication Failed**: Check username/password in connection string
2. **Database Name Wrong**: Verify database name in connection string
3. **Network Timeout**: Check firewall/antivirus settings
4. **Cluster Paused**: Resume cluster in MongoDB Atlas dashboard
5. **IP Not Whitelisted**: Add IP to Network Access in Atlas

## Next Steps

Once seeding is successful:
1. Verify data in MongoDB Compass or Atlas web interface
2. Test API endpoints
3. Check frontend to see products displaying correctly
4. Upload actual product images to Cloudinary (if configured)
5. Update image URLs in products to use Cloudinary URLs
