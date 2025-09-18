import mongoose from "mongoose";
import Plan from "../models/plan.model.js";
import { config } from "dotenv";

config();

const createInitialPlan = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Database ulandi");

    // Mavjud PRO planni tekshirish
    const existingPlan = await Plan.findOne({ name: "pro" });

    if (existingPlan) {
      console.log("PRO plan allaqachon mavjud");
      console.log("Joriy narx:", existingPlan.price, "so'm");
      console.log("Muddat:", existingPlan.duration, "kun");
      process.exit(0);
      return;
    }

    // Yangi PRO plan yaratish
    const plan = await Plan.create({
      name: "pro",
      displayName: "PRO Plan",
      price: 19999, // Boshlang'ich narx
      originalPrice: 40000, // Chegirma uchun
      duration: 30, // 30 kun
      isActive: true,
      features: {
        unlimited: true,
        examMode: true,
        premiumSupport: true,
        detailedAnalysis: true,
      },
      discountEndDate: new Date("2024-08-31"),
    });

    console.log("✅ PRO plan muvaffaqiyatli yaratildi:");
    console.log("Narx:", plan.price, "so'm");
    console.log("Muddat:", plan.duration, "kun");
    console.log("Chegirma:", plan.originalPrice, "so'm dan");

    process.exit(0);
  } catch (error) {
    console.error("❌ Plan yaratishda xatolik:", error);
    process.exit(1);
  }
};

createInitialPlan();
