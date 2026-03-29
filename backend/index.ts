import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import dotenv from "dotenv";

import authRoutes from "./routes/auth";
import verificationRoutes from "./routes/verification";
import voterRoutes from "./routes/voters";
import statsRoutes from "./routes/stats";
import tokenRoutes from "./routes/token";
import pollRoutes from "./routes/polls";
import voteRoutes from "./routes/vote";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/solvotex";

// Middleware
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      // Allow *.wal.app (Walrus) and *.onrender.com (Render hosted services)
      if (origin.endsWith(".wal.app") || origin.endsWith(".onrender.com") || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Serve uploaded files (resolve relative to project root, not dist/)
const uploadsDir = path.resolve(__dirname, "..", "uploads");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", express.static(uploadsDir));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/verify", verificationRoutes);
app.use("/api/voters", voterRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/token", tokenRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/vote", voteRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "SolVoteX Backend", timestamp: new Date() });
});

// Connect to MongoDB and start server
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`SolVoteX Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
