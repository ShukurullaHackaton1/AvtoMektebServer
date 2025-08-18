import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Types.ObjectId,
      required: true,
    },
    templateLang: {
      type: String,
      enum: ["uz", "ru", "kiril", "kaa"],
    },
    templateId: {
      type: Number,
      required: true,
    },
    answerId: {
      type: Number,
      required: true,
    },
    selectVariant: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("history", historySchema);
