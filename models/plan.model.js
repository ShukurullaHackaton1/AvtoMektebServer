import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ["pro"], // Faqat PRO plan uchun
    },
    displayName: {
      type: String,
      required: true,
      default: "PRO Plan",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    originalPrice: {
      type: Number, // Chegirma ko'rsatish uchun (optional)
      min: 0,
    },
    duration: {
      type: Number, // Kunlarda
      required: true,
      default: 30,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    features: {
      unlimited: {
        type: Boolean,
        default: true,
      },
      examMode: {
        type: Boolean,
        default: true,
      },
      premiumSupport: {
        type: Boolean,
        default: true,
      },
      detailedAnalysis: {
        type: Boolean,
        default: true,
      },
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    discountEndDate: {
      type: Date,
    },
    updatedBy: {
      type: mongoose.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Faol PRO planni olish
planSchema.statics.getActivePlan = async function () {
  const plan = await this.findOne({ name: "pro", isActive: true });

  if (!plan) {
    throw new Error("Faol PRO plan topilmadi");
  }

  // Chegirma foizini hisoblash
  if (plan.originalPrice && plan.originalPrice > plan.price) {
    plan.discountPercentage = Math.round(
      ((plan.originalPrice - plan.price) / plan.originalPrice) * 100
    );
  }

  return plan;
};

// Plan narxini yangilash
planSchema.statics.updatePricing = async function (priceData, adminId) {
  const plan = await this.findOneAndUpdate(
    { name: "pro" },
    {
      price: priceData.price,
      originalPrice: priceData.originalPrice,
      duration: priceData.duration,
      discountEndDate: priceData.discountEndDate,
      updatedBy: adminId,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!plan) {
    throw new Error("PRO plan topilmadi");
  }

  return plan;
};

export default mongoose.model("Plan", planSchema);
