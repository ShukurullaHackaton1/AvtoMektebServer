import mongoose from "mongoose";

const eduTypesSchema = new mongoose.Schema(
  {
    id: Number,
    name_uz: String,
    order: Number,
    type_group: Number,
    name_kiril: String,
    name_qq: String,
    name_en: {
      type: String,
      default: null,
    },
    name_ru: String,
    short_name_uz: String,
    short_name_kiril: String,
    short_name_qq: {
      type: String,
      default: null,
    },
    short_name_en: String,
    short_name_ru: String,
    status: Number,
    created_at: {
      type: String,
      default: null,
    },
    updated_at: {
      type: String,
      default: null,
    },
    role: Number,
    category_id: Number,
    image: String,
    code: String,
    name_for_exam: String,
    practical_hours: String,
    theoretical_hours: String,
    uztelecom_code: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("edu-types", eduTypesSchema);
