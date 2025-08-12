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
        message: "Lifetime test limiti tugadi",
        data: {
          plan: user.plan,
          lifetimeUsed: user.lifetimeTestsUsed,
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

// Pro plan tekshirish - FREE planlar ham exam ga kira olishi uchun o'zgartirish
export const checkProPlanOptional = async (req, res, next) => {
  try {
    const { userId } = req.userData;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Foydalanuvchi topilmadi",
      });
    }

    // Free plan ham kira oladi, lekin limit tekshiriladi
    const limitCheck = user.canTakeTest();
    
    if (!limitCheck.canTake) {
      return res.status(403).json({
        status: "error",
        message: "Test limiti tugadi. PRO planga o'ting",
        data: {
          currentPlan: user.plan,
          lifetimeUsed: user.lifetimeTestsUsed,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
        },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Plan check error:", error);
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