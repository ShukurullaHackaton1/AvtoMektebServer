import userModel from "../models/user.model.js";

// Plan limitini tekshirish middleware
export const checkTestLimit = async (req, res, next) => {
  try {
    const { userId } = req.userData;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Foydalanuvchi topilmadi",
      });
    }

    // Test limit tekshirish
    const limitCheck = user.canTakeTest();

    if (!limitCheck.canTake) {
      return res.status(403).json({
        status: "error",
        message: "Kunlik test limiti tugadi",
        data: {
          plan: user.plan,
          dailyUsed: user.dailyTestsUsed,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
        },
      });
    }

    // User ma'lumotlarini request ga qo'shish
    req.user = user;
    next();
  } catch (error) {
    console.error("Plan check error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Pro plan tekshirish
export const checkProPlan = async (req, res, next) => {
  try {
    const { userId } = req.userData;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Foydalanuvchi topilmadi",
      });
    }

    if (user.plan !== "pro") {
      return res.status(403).json({
        status: "error",
        message: "Bu funksiya faqat PRO foydalanuvchilar uchun",
        data: {
          currentPlan: user.plan,
          requiredPlan: "pro",
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Pro plan check error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// Test counter update
export const updateTestCount = async (userId, isCorrect) => {
  try {
    const user = await userModel.findById(userId);
    if (!user) return;

    // Test countini oshirish
    user.incrementTestCount();

    // Correct/Wrong countini oshirish
    if (isCorrect) {
      user.totalCorrect += 1;
    } else {
      user.totalWrong += 1;
    }

    await user.save();
  } catch (error) {
    console.error("Update test count error:", error);
  }
};
