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
import uploadJsonToMongo from "./import.js";
import templatesModel from "./models/templates.model.js";
import axios from "axios";

// ES modules uchun __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();
const app = express();

const port = process.env.PORT || 5000;
const mongo_uri = process.env.MONGO_URI;

// Middleware
const allowedOrigins = [
  "https://avto-mekteb-client.vercel.app",
  "http://localhost:5173", // agar dev uchun kerak bo'lsa
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.get("/uz-test-images/:image", (req, res) => {
  const allowedOrigin = "https://avto-mekteb-client.vercel.app";
  const referer = req.get("referer");

  if (!referer || !referer.startsWith(allowedOrigin)) {
    return res.status(403).send("Forbidden");
  }

  const filePath = path.join(__dirname, "uz-test-images", req.params.image);
  res.sendFile(filePath);
});
app.get("/kiril-test-images", (req, res) => {
  const allowedOrigin = "https://avto-mekteb-client.vercel.app";
  const referer = req.get("referer");

  if (!referer || !referer.startsWith(allowedOrigin)) {
    return res.status(403).send("Forbidden");
  }

  const filePath = path.join(__dirname, "kiril-test-images", req.params.image);
  res.sendFile(filePath);
});
app.get("/ru-test-images/:image", (req, res) => {
  const allowedOrigin = "https://avto-mekteb-client.vercel.app";
  const referer = req.get("referer");

  if (!referer || !referer.startsWith(allowedOrigin)) {
    return res.status(403).send("Forbidden");
  }

  const filePath = path.join(__dirname, "ru-test-images", req.params.image);
  res.sendFile(filePath);
});
app.get("/images/:image", (req, res) => {
  const allowedOrigin = "https://avto-mekteb-client.vercel.app";
  const referer = req.get("referer");

  if (!referer || !referer.startsWith(allowedOrigin)) {
    return res.status(403).send("Forbidden");
  }

  const filePath = path.join(__dirname, "images", req.params.image);
  res.sendFile(filePath);
});
// app.use(
//   "/uz-test-images",
//   express.static(path.join(__dirname, "uz-test-images"))
// );
// app.use(
//   "/ru-test-images",
//   express.static(path.join(__dirname, "ru-test-images"))
// );
// app.use(
//   "/kiril-test-images",
//   express.static(path.join(__dirname, "kiril-test-images"))
// );

// MongoDB ga ulanish
if (!process.env.VERCEL) {
  // Local development da
  mongoose
    .connect(mongo_uri)
    .then(async () => {
      console.log("✅ Database ulandi");

      // uploadJsonToMongo();
    })
    .catch((error) => {
      console.error("❌ Database ulanishida xatolik:", error);
    });
} else {
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
