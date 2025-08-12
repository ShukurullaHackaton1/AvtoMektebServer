import express from "express";
import { config } from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/user.routes.js";
import templateRoutes from "./routes/template.routes.js";
import examRoutes from "./routes/exam.routes.js"; // Exam routes qo'shildi
import paymentRoutes from "./routes/payment.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import path from "path";
import { fileURLToPath } from "url";

// ES modules uchun __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();
const app = express();

const port = process.env.PORT || 5000;
const mongo_uri = process.env.MONGO_URI;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "AvtoTest Server is running!", status: "OK" });
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/exam", examRoutes); // Exam routes qo'shildi
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Static files
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
if (!process.env.VERCEL) {
  // Local development da
  mongoose
    .connect(mongo_uri)
    .then(() => {
      console.log("✅ Database ulandi");
    })
    .catch((error) => {
      console.error("❌ Database ulanishida xatolik:", error);
    });
} else {
  // Vercel da
  mongoose.connect(mongo_uri).catch((error) => {
    console.error("❌ Database ulanishida xatolik:", error);
  });
}

// Server ishga tushirish
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`🚀 Server ${port} portda ishga tushdi`);
  });
}

export default app;
