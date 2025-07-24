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
    plan: {
      type: {
        type: String,
        enum: ["starter", "pro"],
      },
      startTime: {
        type: String,
      },
      endTime: {
        type: String,
      },
      usageRate: {
        type: Number,
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("user", userSchema);
