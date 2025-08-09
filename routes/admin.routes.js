import express from "express";
import jwt from "jsonwebtoken";
import Admin from "../models/admin.model.js";
import userModel from "../models/user.model.js";
import paymentModel from "../models/payment.model.js";
import historiesModel from "../models/histories.model.js";

const router = express.Router();

// Admin authentication middleware
const adminAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin token topilmadi",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.adminId);

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Admin topilmadi yoki faol emas",
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(401).json({
      success: false,
      message: "Admin autentifikatsiya xatoligi",
    });
  }
};

// Admin login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username va password kiritilishi shart",
      });
    }

    // Admin topish (password va salt bilan)
    const admin = await Admin.findOne({ username }).select("+password +salt");

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Noto'g'ri username yoki password",
      });
    }

    // Password tekshirish
    const isValidPassword = admin.validatePassword(password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: "Noto'g'ri username yoki password",
      });
    }

    // Active tekshirish
    if (!admin.isActive) {
      return res.status(400).json({
        success: false,
        message: "Admin hisobi faol emas",
      });
    }

    // JWT token yaratish
    const token = jwt.sign(
      { adminId: admin._id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Login vaqtini yangilash
    await admin.updateLastLogin();

    res.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin._id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          permissions: admin.permissions,
          lastLogin: admin.lastLogin,
        },
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin yaratish (faqat development uchun)
router.post("/create-admin", async (req, res) => {
  try {
    const { username, email, password, role = "admin" } = req.body;

    // Mavjudligini tekshirish
    const existingAdmin = await Admin.findOne({
      $or: [{ username }, { email }],
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Bu username yoki email allaqachon mavjud",
      });
    }

    // Yangi admin yaratish
    const admin = new Admin({
      username,
      email,
      role,
      permissions: ["view_users", "view_payments", "view_analytics"],
    });

    admin.setPassword(password);
    await admin.save();

    res.status(201).json({
      success: true,
      data: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Dashboard statistics
router.get("/dashboard", adminAuth, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const startOfWeek = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - today.getDay()
    );
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Umumiy statistika
    const totalUsers = await userModel.countDocuments();
    const proUsers = await userModel.countDocuments({ plan: "pro" });
    const freeUsers = totalUsers - proUsers;

    // Bugungi statistika
    const todayUsers = await userModel.countDocuments({
      createdAt: { $gte: startOfDay },
    });

    const todayPayments = await paymentModel.aggregate([
      {
        $match: {
          status: "paid",
          createdAt: { $gte: startOfDay },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Haftalik daromad
    const weeklyRevenue = await paymentModel.aggregate([
      {
        $match: {
          status: "paid",
          createdAt: { $gte: startOfWeek },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Oylik daromad
    const monthlyRevenue = await paymentModel.aggregate([
      {
        $match: {
          status: "paid",
          createdAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Top foydalanuvchilar
    const topUsers = await userModel
      .find()
      .select(
        "firstname lastname totalTests totalCorrect successRate createdAt plan"
      )
      .sort({ totalTests: -1 })
      .limit(10);

    // Oxirgi to'lovlar
    const recentPayments = await paymentModel
      .find({ status: "paid" })
      .populate("userId", "firstname lastname phone")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          proUsers,
          freeUsers,
          todayUsers,
          todayRevenue: todayPayments[0]?.total || 0,
          todayPayments: todayPayments[0]?.count || 0,
          weeklyRevenue: weeklyRevenue[0]?.total || 0,
          monthlyRevenue: monthlyRevenue[0]?.total || 0,
        },
        topUsers,
        recentPayments,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Foydalanuvchilar ro'yxati
router.get("/users", adminAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      plan,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (plan && plan !== "all") {
      filter.plan = plan;
    }

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const users = await userModel
      .find(filter)
      .select("-password")
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const totalUsers = await userModel.countDocuments(filter);

    // Har bir foydalanuvchi uchun qo'shimcha ma'lumotlar
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const successRate =
          user.totalTests > 0
            ? Math.round((user.totalCorrect / user.totalTests) * 100)
            : 0;

        const lastPayment = await paymentModel
          .findOne({ userId: user._id, status: "paid" })
          .sort({ createdAt: -1 });

        return {
          ...user,
          successRate,
          lastPayment: lastPayment?.createdAt || null,
          planExpiry: user.planExpiryDate,
        };
      })
    );

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalUsers / limit),
          totalUsers,
          hasMore: page * limit < totalUsers,
        },
      },
    });
  } catch (error) {
    console.error("Users list error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bitta foydalanuvchi haqida to'liq ma'lumot
router.get("/users/:userId", adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await userModel.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Foydalanuvchi topilmadi",
      });
    }

    // To'lovlar tarixi
    const payments = await paymentModel
      .find({ userId })
      .sort({ createdAt: -1 });

    // Xatolar statistikasi
    const mistakes = await historiesModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    // Oylik test statistikasi
    const monthlyStats = await userModel.aggregate([
      { $match: { _id: user._id } },
      {
        $project: {
          successRate: {
            $cond: [
              { $gt: ["$totalTests", 0] },
              {
                $multiply: [{ $divide: ["$totalCorrect", "$totalTests"] }, 100],
              },
              0,
            ],
          },
          totalTests: 1,
          totalCorrect: 1,
          totalWrong: 1,
          plan: 1,
          createdAt: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        user: {
          ...user.toObject(),
          successRate: monthlyStats[0]?.successRate || 0,
        },
        payments,
        mistakes: mistakes.slice(0, 20), // Faqat 20 ta oxirgi xato
        stats: {
          totalPayments: payments.length,
          totalPaidAmount: payments
            .filter((p) => p.status === "paid")
            .reduce((sum, p) => sum + p.amount, 0),
          totalMistakes: mistakes.length,
        },
      },
    });
  } catch (error) {
    console.error("User details error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// To'lovlar sahifasi
router.get("/payments", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, period = "week" } = req.query;

    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }

    // Vaqt filtri
    const now = new Date();
    let startDate;

    switch (period) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 7
        );
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 7
        );
    }

    filter.createdAt = { $gte: startDate };

    const payments = await paymentModel
      .find(filter)
      .populate("userId", "firstname lastname phone")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalPayments = await paymentModel.countDocuments(filter);

    // Statistika
    const stats = await paymentModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Kunlik daromad (oxirgi 30 kun)
    const dailyRevenue = await paymentModel.aggregate([
      {
        $match: {
          status: "paid",
          createdAt: {
            $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          amount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalPayments / limit),
          totalPayments,
        },
        stats: {
          overview: stats,
          dailyRevenue,
          totalRevenue: stats
            .filter((s) => s._id === "paid")
            .reduce((sum, s) => sum + s.total, 0),
        },
      },
    });
  } catch (error) {
    console.error("Payments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Analytics - Foydalanuvchilar o'sishi
router.get("/analytics/user-growth", adminAuth, async (req, res) => {
  try {
    const { period = "month" } = req.query;

    let groupFormat, startDate;
    const now = new Date();

    switch (period) {
      case "week":
        groupFormat = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        groupFormat = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        groupFormat = {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        };
        startDate = new Date(
          now.getFullYear() - 1,
          now.getMonth(),
          now.getDate()
        );
        break;
      default:
        groupFormat = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const userGrowth = await userModel.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: groupFormat,
          newUsers: { $sum: 1 },
          proUsers: {
            $sum: { $cond: [{ $eq: ["$plan", "pro"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: userGrowth,
    });
  } catch (error) {
    console.error("User growth analytics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Analytics - Daromad statistikasi
router.get("/analytics/revenue", adminAuth, async (req, res) => {
  try {
    const { period = "month" } = req.query;

    let groupFormat, startDate;
    const now = new Date();

    switch (period) {
      case "week":
        groupFormat = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        groupFormat = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        groupFormat = {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        };
        startDate = new Date(
          now.getFullYear() - 1,
          now.getMonth(),
          now.getDate()
        );
        break;
      default:
        groupFormat = {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        };
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const revenueData = await paymentModel.aggregate([
      {
        $match: {
          status: "paid",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: groupFormat,
          revenue: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: revenueData,
    });
  } catch (error) {
    console.error("Revenue analytics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
