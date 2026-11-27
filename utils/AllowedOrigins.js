import dotenv from "dotenv";
dotenv.config(); // imports pehle chalte hain, isliye env yahan hi load kar lete hain

const fromEnv = (process.env.ALLOWED_ORIGINS || "")
   .split(",")
   .map((o) => o.trim().replace(/\/$/, ""))
   .filter(Boolean);

const localOrigins = process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"];

export const allowedOrigins = [...new Set([...localOrigins, ...fromEnv])];
