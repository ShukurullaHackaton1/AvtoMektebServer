import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
    },
    lastname: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    totalTests: {
      type: Number,
      default: 0,
    },
    totalCorrect: {
      type: Number,
      default: 0,
    },
    totalWrong: {
      type: Number,
      default: 0,
    },
    // Plan tizimi
    plan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },
    dailyTestsUsed: {
      type: Number,
      default: 0,
    },
    lastTestDate: {
      type: Date,
      default: null,
    },
    planExpiryDate: {
      type: Date,
      default: null,
    },
    planPurchaseHistory: [
      {
        purchaseDate: {
          type: Date,
          default: Date.now,
        },
        amount: Number,
        plan: String,
        status: {
          type: String,
          enum: ["pending", "paid", "expired"],
          default: "pending",
        },
        clickTransactionId: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Kunlik testlar sonini reset qilish metodi
userSchema.methods.resetDailyTests = function () {
  const today = new Date();
  const lastTestDate = this.lastTestDate;

  if (
    !lastTestDate ||
    lastTestDate.getDate() !== today.getDate() ||
    lastTestDate.getMonth() !== today.getMonth() ||
    lastTestDate.getFullYear() !== today.getFullYear()
  ) {
    this.dailyTestsUsed = 0;
    this.lastTestDate = today;
  }
};

// Test limit tekshirish metodi
userSchema.methods.canTakeTest = function () {
  this.resetDailyTests();

  if (this.plan === "pro") {
    // Pro plan uchun unlimited
    return { canTake: true, remaining: "unlimited" };
  } else {
    // Free plan uchun 20 ta kuniga
    const dailyLimit = 20;
    const remaining = dailyLimit - this.dailyTestsUsed;
    return {
      canTake: remaining > 0,
      remaining: remaining,
      limit: dailyLimit,
    };
  }
};

// Test count increment metodi
userSchema.methods.incrementTestCount = function () {
  this.resetDailyTests();

  if (this.plan === "free") {
    this.dailyTestsUsed += 1;
  }

  this.totalTests += 1;
  this.lastTestDate = new Date();
};

export default mongoose.model("user", userSchema);
