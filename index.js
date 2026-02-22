import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

// Middlewares
import ErrorHandler from "./middlewares/ErrorHandler.js";
import ErrorLogger from "./middlewares/ErrorLogger.js";
import RateLimiter from "./middlewares/RateLimiter.js";
import SecurityHeaders from "./middlewares/HelmetMiddleware.js";

// DB Connection
import connectDB from "./config/DB.js";

// Routes
import AuthRoutes from "./routes/AuthRoutes.js";
import CounterRoutes from "./routes/CounterRoutes.js";
import NewsUpdateRoutes from "./routes/NewsUpdateRoutes.js";
import { allowedOrigins } from "./utils/AllowedOrigins.js";

// Cloudinary
import { v2 as cloudinary } from "cloudinary";
import fileUpload from "express-fileupload";

dotenv.config();

const app = express();

app.use(SecurityHeaders);

// === MongoDB Connection ===
connectDB();

// === Global Middlewares ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
   cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["POST", "GET", "PATCH", "DELETE"],
   }),
);

// === Cloudinary Configuration ===
cloudinary.config({
   cloud_name: process.env.CLOUDINARY_Cloud,
   api_secret: process.env.CLOUDINARY_API_SECRET,
   api_key: process.env.CLOUDINARY_API_KEY,
});

app.use(
   fileUpload({
      useTempFiles: true,
      tempFileDir: "/tmp/",
   }),
);

app.get("/", (req, res) => {
   res.status(200).json({ heath: "Ok" });
});

// === Rate Limiter
app.use(RateLimiter);

// === Logger Middleware for logging errors
app.use(ErrorLogger);

// === Routes ===
app.use("/api", AuthRoutes);
app.use("/api/news", NewsUpdateRoutes);
app.use("/api/counter", CounterRoutes);

// === Error Handler
app.use(ErrorHandler);

// === Server Start ===
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
   console.log(`🚀 Server running on http://localhost:${PORT}`);
});
