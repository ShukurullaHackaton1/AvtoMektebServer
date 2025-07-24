import mongoose from "mongoose";

const templateSchema = new mongoose.Schema(
  {
    template: {
      type: Object,
      required: true,
    },
    templateLang: {
      type: String,
      enum: ["ru", "uz", "kiril"],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("template", templateSchema);
