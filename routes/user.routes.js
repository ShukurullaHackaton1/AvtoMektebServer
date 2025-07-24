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
        message: "Iltimos barcha maydonlarn toliq kiriting",
      });
    }

    if (password !== confirmpassword) {
      return res.status(400).json({
        status: "error",
        message: "tasdiqlash passwordi asl password bilan mos kelmadi",
      });
    }

    if (phone.length !== 8) {
      return res.status(400).json({
        status: "error",
        message: "Telefon raqamining formatini to'g'ri kiriting",
      });
    }

    const findUser = await userModel.findOne({ phone });
    if (findUser) {
      return res.status(400).json({
        status: "error",
        message: "Bunday foydalanuvchi oldin ro'yhatdan o'tgan",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createUser = await userModel.create({
      ...req.body,
      password: hashedPassword,
    });

    const getToken = token(createUser._id);

    res
      .status(200)
      .json({ status: "success", data: createUser, token: getToken });
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
        message: "Iltimos barcha maydonlarn toliq kiriting",
      });
    }

    if (phone.length !== 8) {
      return res.status(400).json({
        status: "error",
        message: "Telefon raqamining formatini to'g'ri kiriting",
      });
    }

    const findUser = await userModel.findOne({ phone });
    if (!findUser) {
      return res.status(400).json({
        status: "error",
        message: "Bunday foydalanuvchi oldin ro'yhatdan o'tmagan",
      });
    }

    const comparePassword = await bcrypt.compare(password, findUser.password);

    if (!comparePassword) {
      return res
        .status(400)
        .json({ status: "error", message: "Password mos kelmadi" });
    }

    const getToken = token(findUser._id);

    res
      .status(200)
      .json({ status: "success", data: findUser, token: getToken });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const findUser = await userModel.findById(userId);

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

export default router;
