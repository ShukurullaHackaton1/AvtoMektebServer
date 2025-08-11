import express from "express";
import userModel from "../models/user.model.js";
import bcrypt from "bcrypt";
import token from "../utils/generateToken.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/sign", async (req, res) => {
  try {
    const { firstname, lastname, phone, password, confirmpassword } = req.body;

    if (!firstname || !lastname || !phone || !password || !confirmpassword) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos barcha maydonlarni to'liq kiriting",
      });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({
        status: "error",
        message: "Tasdiqlash passwordi asl password bilan mos kelmadi",
      });
    }

    const findUser = await userModel.findOne({ phone });
    if (findUser) {
      return res.status(400).json({
        status: "error",
        message: "Bunday foydalanuvchi oldin ro'yxatdan o'tgan",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createUser = await userModel.create({
      firstname,
      lastname,
      phone,
      password: hashedPassword,
    });

    const getToken = token(createUser._id);

    res.status(200).json({
      status: "success",
      data: {
        id: createUser._id,
        firstname: createUser.firstname,
        lastname: createUser.lastname,
        phone: createUser.phone,
        totalTests: createUser.totalTests,
        totalCorrect: createUser.totalCorrect,
        totalWrong: createUser.totalWrong,
      },
      token: getToken,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({
        status: "error",
        message: "Iltimos barcha maydonlarni to'liq kiriting",
      });
    }

    // Admin username bilan kirish imkoniyati
    if (phone.length < 9) {
      // Bu username bo'lishi mumkin, admin modeldan tekshirish
      const Admin = (await import("../models/admin.model.js")).default;
      const admin = await Admin.findOne({ username: phone }).select(
        "+password +salt"
      );

      if (admin && admin.validatePassword(password) && admin.isActive) {
        const token = jwt.sign(
          { adminId: admin._id, username: admin.username, role: admin.role },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        await admin.updateLastLogin();

        return res.status(200).json({
          status: "success",
          data: {
            id: admin._id,
            username: admin.username,
            email: admin.email,
            role: admin.role,
          },
          token: token,
        });
      }
    }

    // Normal phone validation
    if (phone.length !== 9) {
      return res.status(400).json({
        status: "error",
        message: "Telefon raqamining formatini to'g'ri kiriting",
      });
    }

    // Normal user login
    const findUser = await userModel.findOne({ phone });
    if (!findUser) {
      return res.status(400).json({
        status: "error",
        message: "Bunday foydalanuvchi oldin ro'yxatdan o'tmagan",
      });
    }

    const comparePassword = await bcrypt.compare(password, findUser.password);

    if (!comparePassword) {
      return res
        .status(400)
        .json({ status: "error", message: "Password mos kelmadi" });
    }

    const getToken = token(findUser._id);

    res.status(200).json({
      status: "success",
      data: {
        id: findUser._id,
        firstname: findUser.firstname,
        lastname: findUser.lastname,
        phone: findUser.phone,
        totalTests: findUser.totalTests,
        totalCorrect: findUser.totalCorrect,
        totalWrong: findUser.totalWrong,
        plan: findUser.plan,
        planExpiryDate: findUser.planExpiryDate,
      },
      token: getToken,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findUser = await userModel.findById(userId).select("-password");

    if (!findUser) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday foydalanuvchi topilmadi" });
    }

    res.status(200).json({ status: "success", data: findUser });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Statistikani olish
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await userModel
      .findById(userId)
      .select("totalTests totalCorrect totalWrong");

    if (!user) {
      return res
        .status(400)
        .json({ status: "error", message: "Foydalanuvchi topilmadi" });
    }

    const successRate =
      user.totalTests > 0
        ? Math.round((user.totalCorrect / user.totalTests) * 100)
        : 0;

    res.status(200).json({
      status: "success",
      data: {
        totalTests: user.totalTests,
        totalCorrect: user.totalCorrect,
        totalWrong: user.totalWrong,
        successRate: successRate,
      },
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
