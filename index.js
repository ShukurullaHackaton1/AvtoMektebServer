import express from "express";
import { config } from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/user.routes.js";
import templateRoutes from "./routes/template.routes.js";
import path from "path";
import { fileURLToPath } from "url";
config();
const app = express();

const port = process.env.PORT || 5000;
const mongo_uri = process.env.MONGO_URI;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/templates", templateRoutes);
app.use(
  "/uz-test-images",
  express.static(path.join(__dirname, "uz-test-images"))
);
app.use(
  "/ru-test-images",
  express.static(path.join(__dirname, "ru-test-images"))
);
app.use(
  "/kiril-test-images",
  express.static(path.join(__dirname, "kiril-test-images"))
);
// MongoDB ga ulanish
mongoose
  .connect(mongo_uri)
  .then(() => {
    console.log("✅ Database ulandi");
  })
  .catch((error) => {
    console.error("❌ Database ulanishida xatolik:", error);
  });

// Server ishga tushirish
app.listen(port, () => {
  console.log(`🚀 Server ${port} portda ishga tushdi`);
});
