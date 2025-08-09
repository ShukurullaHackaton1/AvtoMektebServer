import mongoose from "mongoose";
import crypto from "crypto";

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    salt: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "super_admin"],
      default: "admin",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    permissions: [
      {
        type: String,
        enum: [
          "view_users",
          "edit_users",
          "view_payments",
          "view_analytics",
          "manage_templates",
        ],
        default: ["view_users", "view_payments", "view_analytics"],
      },
    ],
  },
  { timestamps: true }
);

// Password hash qilish metodlari
adminSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString("hex");
  this.password = crypto
    .pbkdf2Sync(password, this.salt, 1000, 64, "sha512")
    .toString("hex");
};

adminSchema.methods.validatePassword = function (password) {
  const hash = crypto
    .pbkdf2Sync(password, this.salt, 1000, 64, "sha512")
    .toString("hex");
  return this.password === hash;
};

// Login vaqtini yangilash
adminSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save();
};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
