// routes/payment.routes.js - FINAL FIXED VERSION
import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import paymentModel from "../models/payment.model.js";
import userModel from "../models/user.model.js";
import md5 from "md5";
import { config } from "dotenv";
const router = express.Router();
config();
// Click sozlamalari
const CLICK_SERVICE_ID = process.env.CLICK_SERVICE_ID;
const CLICK_MERCHANT_ID = process.env.CLICK_MERCHANT_ID;
const CLICK_SECRET_KEY = process.env.CLICK_SECRET_KEY;

// Click uchun JSON middleware
const clickJsonMiddleware = (req, res, next) => {
  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function (data) {
    res.set("Content-Type", "application/json; charset=utf-8");
    return originalJson.call(this, data);
  };

  res.send = function (data) {
    if (typeof data === "object") {
      res.set("Content-Type", "application/json; charset=utf-8");
      return originalJson.call(this, data);
    }
    return originalSend.call(this, data);
  };

  next();
};

// Apply middleware
router.use("/prepare", clickJsonMiddleware);
router.use("/complete", clickJsonMiddleware);

// Log middleware
router.use((req, res, next) => {
  if (req.path === "/prepare" || req.path === "/complete") {
    console.log("=".repeat(80));
    console.log(`📨 CLICK SO'ROV:`, {
      method: req.method,
      path: req.path,
      body: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString(),
    });
    console.log("=".repeat(80));
  }
  next();
});

// Error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error("❌ Xatolik:", error);
    res.status(200).json({
      error: -9,
      error_note: "Technical error",
    });
  });
};

// Signature check
const checkClickSignature = (data, signString) => {
  const {
    click_trans_id,
    service_id,
    merchant_trans_id,
    merchant_prepare_id,
    amount,
    action,
    sign_time,
  } = data;

  let hashString = "";

  if (action == 0) {
    // Prepare
    hashString = `${click_trans_id}${service_id}${CLICK_SECRET_KEY}${merchant_trans_id}${amount}${action}${sign_time}`;
  } else {
    // Complete
    hashString = `${click_trans_id}${service_id}${CLICK_SECRET_KEY}${merchant_trans_id}${
      merchant_prepare_id || ""
    }${amount}${action}${sign_time}`;
  }

  const hash = md5(hashString);

  console.log("🔐 Signature check:", {
    calculated: hash,
    received: signString,
    valid: hash === signString,
  });

  return hash === signString;
};

// PREPARE endpoint
router.post(
  "/prepare",
  asyncHandler(async (req, res) => {
    console.log("🟢 PREPARE boshlanishi");

    try {
      const {
        click_trans_id,
        service_id,
        merchant_trans_id,
        amount,
        action,
        sign_time,
        sign_string,
        merchant_user_id, // Bu ham kelishi mumkin
      } = req.body;

      // Service ID check
      if (service_id != CLICK_SERVICE_ID) {
        console.log(`❌ Service ID xato: ${service_id} != ${CLICK_SERVICE_ID}`);
        return res.status(200).json({
          error: -8,
          error_note: "Invalid service_id",
        });
      }

      // Signature check
      if (!checkClickSignature(req.body, sign_string)) {
        console.log("❌ Signature xato");
        return res.status(200).json({
          error: -1,
          error_note: "Invalid signature",
        });
      }

      // Find payment
      let payment;
      try {
        payment = await paymentModel.findById(merchant_trans_id);
      } catch (err) {
        console.log("❌ Payment ID format xato:", merchant_trans_id);
        return res.status(200).json({
          error: -5,
          error_note: "Invalid payment ID format",
        });
      }

      if (!payment) {
        console.log("❌ Payment topilmadi:", merchant_trans_id);
        return res.status(200).json({
          error: -5,
          error_note: "Payment not found",
        });
      }

      // Amount check
      if (Number(amount) !== payment.amount) {
        console.log(`❌ Amount xato: ${amount} != ${payment.amount}`);
        return res.status(200).json({
          error: -2,
          error_note: `Invalid amount: expected ${payment.amount}, got ${amount}`,
        });
      }

      // Already paid check
      if (payment.status === "paid") {
        console.log("⚠️ Allaqachon to'langan");
        return res.status(200).json({
          error: -4,
          error_note: "Already paid",
        });
      }

      // Create prepare ID
      const merchant_prepare_id = Date.now().toString();

      // Update payment
      payment.clickPrepareId = merchant_prepare_id;
      payment.clickTransactionId = click_trans_id;
      await payment.save();

      console.log("✅ PREPARE muvaffaqiyatli:", {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id,
        amount,
      });

      // MUHIM: Click dokumentatsiyasiga mos javob
      return res.status(200).json({
        click_trans_id: click_trans_id,
        merchant_trans_id: merchant_trans_id,
        merchant_prepare_id: merchant_prepare_id,
        error: 0,
        error_note: "Success",
      });
    } catch (error) {
      console.error("❌ PREPARE xatolik:", error);
      return res.status(200).json({
        error: -9,
        error_note: "Technical error",
      });
    }
  })
);

// COMPLETE endpoint
router.post(
  "/complate",
  asyncHandler(async (req, res) => {
    console.log("🏁 COMPLETE boshlanishi");

    try {
      const {
        click_trans_id,
        service_id,
        merchant_trans_id,
        merchant_prepare_id,
        amount,
        action,
        sign_time,
        sign_string,
        error: clickError,
        error_note,
      } = req.body;

      console.log("📊 COMPLETE parametrlari:", {
        click_trans_id,
        service_id,
        merchant_trans_id,
        merchant_prepare_id,
        amount,
        action,
        clickError,
        error_note,
      });

      // Click error check
      if (clickError && clickError != 0) {
        console.log(`❌ Click error: ${clickError} - ${error_note}`);

        try {
          await paymentModel.findByIdAndUpdate(merchant_trans_id, {
            status: "failed",
            failureReason: error_note || `Click error: ${clickError}`,
          });
        } catch (err) {
          console.log("Payment update error:", err);
        }

        return res.status(200).json({
          click_trans_id: click_trans_id,
          merchant_trans_id: merchant_trans_id,
          merchant_confirm_id: Date.now().toString(),
          error: -9,
          error_note: "Transaction cancelled",
        });
      }

      // Signature check
      if (!checkClickSignature(req.body, sign_string)) {
        console.log("❌ Signature xato");
        return res.status(200).json({
          error: -1,
          error_note: "Invalid signature",
        });
      }

      // Find payment
      let payment;
      try {
        payment = await paymentModel.findById(merchant_trans_id);
      } catch (err) {
        console.log("❌ Payment ID format xato");
        return res.status(200).json({
          error: -5,
          error_note: "Invalid payment ID",
        });
      }

      if (!payment) {
        console.log("❌ Payment topilmadi");
        return res.status(200).json({
          error: -5,
          error_note: "Payment not found",
        });
      }

      // Already paid check
      if (payment.status === "paid") {
        console.log("⚠️ Allaqachon to'langan - success qaytaramiz");
        return res.status(200).json({
          click_trans_id: click_trans_id,
          merchant_trans_id: merchant_trans_id,
          merchant_confirm_id: payment.clickCompleteId || Date.now().toString(),
          error: 0,
          error_note: "Already paid",
        });
      }

      // Process payment
      const merchant_confirm_id = Date.now().toString();
      const currentDate = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(currentDate.getDate() + (payment.planDuration || 30));

      // Update payment
      await paymentModel.findByIdAndUpdate(merchant_trans_id, {
        status: "paid",
        clickTransactionId: click_trans_id,
        clickPrepareId: merchant_prepare_id,
        clickCompleteId: merchant_confirm_id,
        planStartDate: currentDate,
        planEndDate: expiryDate,
      });

      // Update user
      await userModel.findByIdAndUpdate(payment.userId, {
        plan: "pro",
        planExpiryDate: expiryDate,
        $push: {
          planPurchaseHistory: {
            purchaseDate: currentDate,
            amount: payment.amount,
            plan: "pro",
            status: "paid",
            clickTransactionId: click_trans_id,
          },
        },
      });

      console.log(
        `✅ COMPLETE muvaffaqiyatli: User ${payment.userId} PRO planga o'tdi`
      );

      // Success response
      return res.status(200).json({
        click_trans_id: click_trans_id,
        merchant_trans_id: merchant_trans_id,
        merchant_confirm_id: merchant_confirm_id,
        error: 0,
        error_note: "Success",
      });
    } catch (error) {
      console.error("❌ COMPLETE xatolik:", error);
      return res.status(200).json({
        error: -9,
        error_note: "Technical error",
      });
    }
  })
);

// CREATE PAYMENT - URL parametrlarini to'g'rilash
router.post("/create-payment", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Foydalanuvchi topilmadi",
      });
    }

    // Get plan price
    const Plan = (await import("../models/plan.model.js")).default;
    let activePlan;

    try {
      activePlan = await Plan.getActivePlan();
    } catch (error) {
      activePlan = {
        price: 19999,
        duration: 30,
        displayName: "PRO Plan",
      };
    }

    // Delete existing pending payments
    await paymentModel.deleteMany({
      userId,
      status: "pending",
    });

    // Create new payment
    const newPayment = await paymentModel.create({
      userId,
      amount: activePlan.price,
      plan: "pro",
      planDuration: activePlan.duration,
      status: "pending",
      description: `${activePlan.displayName} - ${activePlan.duration} kun`,
      paymentMethod: "click",
    });

    // MUHIM: Click URL parametrlarini to'g'ri formatda yaratish
    const params = new URLSearchParams({
      service_id: CLICK_SERVICE_ID,
      merchant_id: CLICK_MERCHANT_ID,
      amount: activePlan.price,
      transaction_param: newPayment._id.toString(),
      return_url: "https://avto-mekteb-client.vercel.app/payment-success",
    });

    const clickUrl = `https://my.click.uz/services/pay?${params.toString()}`;

    console.log("📎 Click URL yaratildi:", clickUrl);

    res.json({
      status: "success",
      data: {
        paymentId: newPayment._id,
        amount: activePlan.price,
        clickUrl: clickUrl,
        description: `${activePlan.displayName} - ${activePlan.duration} kun`,
      },
    });
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// TEST endpoint
router.get("/test", (req, res) => {
  res.json({
    status: "success",
    message: "Click integration working",
    timestamp: new Date().toISOString(),
    config: {
      SERVICE_ID: CLICK_SERVICE_ID,
      MERCHANT_ID: CLICK_MERCHANT_ID,
      SECRET_KEY_SET: !!CLICK_SECRET_KEY,
    },
  });
});

// PAYMENT STATUS
router.get("/payment-status/:paymentId", authMiddleware, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { userId } = req.userData;

    const payment = await paymentModel.findOne({
      _id: paymentId,
      userId,
    });

    if (!payment) {
      return res.status(404).json({
        status: "error",
        message: "To'lov topilmadi",
      });
    }

    res.json({
      status: "success",
      data: {
        paymentId: payment._id,
        status: payment.status,
        amount: payment.amount,
        plan: payment.plan,
        createdAt: payment.createdAt,
        planStartDate: payment.planStartDate,
        planEndDate: payment.planEndDate,
      },
    });
  } catch (error) {
    console.error("Payment status error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
