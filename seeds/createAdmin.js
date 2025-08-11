import mongoose from "mongoose";
import Admin from "../models/admin.model.js";
import { config } from "dotenv";

config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const adminData = {
      username: "admin",
      email: "admin@avtotest.uz",
      role: "super_admin",
      permissions: [
        "view_users",
        "edit_users",
        "view_payments",
        "view_analytics",
        "manage_templates",
      ],
    };

    const existingAdmin = await Admin.findOne({ username: adminData.username });
    if (existingAdmin) {
      console.log("Admin allaqachon mavjud");
      return;
    }

    const admin = new Admin(adminData);
    admin.setPassword("admin123456"); // O'zgartiring!
    await admin.save();

    console.log("Admin yaratildi:");
    console.log("Username:", adminData.username);
    console.log("Password: admin123456"); // O'zgartiring!

    process.exit(0);
  } catch (error) {
    console.error("Admin yaratishda xatolik:", error);
    process.exit(1);
  }
};

createAdmin();
