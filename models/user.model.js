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
    lifetimeTestsUsed: {
      type: Number,
      default: 0,
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

// Test limit tekshirish metodi - lifetime uchun
userSchema.methods.canTakeTest = function () {
  if (this.plan === "pro") {
    // Pro plan uchun unlimited
    return { canTake: true, remaining: "unlimited" };
  } else {
    // Free plan uchun lifetime 20 ta
    const lifetimeLimit = 20;
    const remaining = lifetimeLimit - this.lifetimeTestsUsed;
    return {
      canTake: remaining > 0,
      remaining: remaining,
      limit: lifetimeLimit,
    };
  }
};

// Test count increment metodi - lifetime uchun
userSchema.methods.incrementTestCount = function () {
  if (this.plan === "free") {
    this.lifetimeTestsUsed += 1;
  }
  this.totalTests += 1;
};

export default mongoose.model("user", userSchema);