import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "user",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      default: 1000, // 1000 so'm
    },
    plan: {
      type: String,
      enum: ["pro"],
      default: "pro",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["click"],
      default: "click",
    },
    // Click integration fields
    clickTransactionId: {
      type: String,
      sparse: true,
    },
    clickPrepareId: {
      type: String,
      sparse: true,
    },
    clickCompleteId: {
      type: String,
      sparse: true,
    },
    // Plan details
    planStartDate: {
      type: Date,
    },
    planEndDate: {
      type: Date,
    },
    description: {
      type: String,
      default: "PRO Plan - Unlimited tests",
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ clickTransactionId: 1 }, { sparse: true });
paymentSchema.index({ createdAt: -1 });

export default mongoose.model("payment", paymentSchema);
