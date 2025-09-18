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
    },
    plan: {
      type: String,
      enum: ["pro"],
      default: "pro",
    },
    planDuration: {
      type: Number, // Kunlarda
      required: true,
      default: 30,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["click", "payme", "uzum"],
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
    },
    // Discount information
    originalPrice: {
      type: Number,
    },
    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    // Transaction details
    transactionId: {
      type: String,
      sparse: true,
    },
    failureReason: {
      type: String,
    },
    // User IP and device info
    userIp: {
      type: String,
    },
    userAgent: {
      type: String,
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
paymentSchema.index({ status: 1, createdAt: -1 });

// Virtual field for expiry check
paymentSchema.virtual("isExpired").get(function () {
  if (this.status === "paid" && this.planEndDate) {
    return new Date() > this.planEndDate;
  }
  return true;
});

// Method to calculate remaining days
paymentSchema.methods.getRemainingDays = function () {
  if (this.status === "paid" && this.planEndDate) {
    const now = new Date();
    const endDate = new Date(this.planEndDate);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }
  return 0;
};

// Static method to get user's active payment
paymentSchema.statics.getActivePayment = async function (userId) {
  const payment = await this.findOne({
    userId,
    status: "paid",
    planEndDate: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  return payment;
};

// Static method to get payment statistics
paymentSchema.statics.getStatistics = async function (startDate, endDate) {
  const match = {
    status: "paid",
  };

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
        totalPayments: { $sum: 1 },
        averagePayment: { $avg: "$amount" },
        minPayment: { $min: "$amount" },
        maxPayment: { $max: "$amount" },
      },
    },
    {
      $project: {
        _id: 0,
        totalRevenue: 1,
        totalPayments: 1,
        averagePayment: { $round: ["$averagePayment", 2] },
        minPayment: 1,
        maxPayment: 1,
      },
    },
  ]);

  return (
    stats[0] || {
      totalRevenue: 0,
      totalPayments: 0,
      averagePayment: 0,
      minPayment: 0,
      maxPayment: 0,
    }
  );
};

export default mongoose.model("payment", paymentSchema);
