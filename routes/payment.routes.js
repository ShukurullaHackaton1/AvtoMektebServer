import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import paymentModel from "../models/payment.model.js";
import userModel from "../models/user.model.js";
import md5 from "md5";

const router = express.Router();

// Click sozlamalari - .env dan olinadi
const CLICK_SERVICE_ID = process.env.CLICK_SERVICE_ID;
const CLICK_MERCHANT_ID = process.env.CLICK_MERCHANT_ID;
const CLICK_SECRET_KEY = process.env.CLICK_SECRET_KEY;

// PRO plan uchun to'lov havolasini yaratish
router.post("/create-payment", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    // Foydalanuvchi ma'lumotlarini olish
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "Foydalanuvchi topilmadi",
      });
    }

    // Agar allaqachon PRO plan bo'lsa
    if (
      user.plan === "pro" &&
      user.planExpiryDate &&
      user.planExpiryDate > new Date()
    ) {
      return res.status(400).json({
        status: "error",
        message: "Sizda allaqachon faol PRO plan mavjud",
      });
    }

    // Kutilayotgan to'lovni tekshirish
    const existingPayment = await paymentModel.findOne({
      userId,
      status: "pending",
    });

    if (existingPayment) {
      // Mavjud to'lov havolasini qaytarish
      const clickUrl = `https://my.click.uz/services/pay?service_id=${CLICK_SERVICE_ID}&merchant_id=${CLICK_MERCHANT_ID}&amount=35000&transaction_param=${existingPayment._id}`;

      return res.status(200).json({
        status: "success",
        data: {
          paymentId: existingPayment._id,
          amount: 35000,
          clickUrl: clickUrl,
          qrCode: clickUrl,
          description: "PRO Plan - Unlimited tests",
        },
      });
    }

    // Yangi to'lov yozuvini yaratish
    const newPayment = await paymentModel.create({
      userId,
      amount: 35000, // 35,000 so'm
      plan: "pro",
      status: "pending",
      description: "PRO Plan - Unlimited tests",
    });

    // Click to'lov havolasini yaratish
    const clickUrl = `https://my.click.uz/services/pay?service_id=${CLICK_SERVICE_ID}&merchant_id=${CLICK_MERCHANT_ID}&amount=35000&transaction_param=${newPayment._id}`;

    res.status(200).json({
      status: "success",
      data: {
        paymentId: newPayment._id,
        amount: 35000,
        clickUrl: clickUrl,
        qrCode: clickUrl,
        description: "PRO Plan - Unlimited tests",
      },
    });
  } catch (error) {
    console.error("Create payment error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// To'lov holatini tekshirish
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

    res.status(200).json({
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

// Foydalanuvchining to'lovlar tarixi
router.get("/payment-history", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const payments = await paymentModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .select(
        "amount plan status createdAt planStartDate planEndDate description"
      );

    res.status(200).json({
      status: "success",
      data: payments,
    });
  } catch (error) {
    console.error("Payment history error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// ============ CLICK WEBHOOK ENDPOINTS ============

// Signature tekshirish funksiyasi
const clickCheckToken = (data, signString) => {
  const {
    click_trans_id,
    service_id,
    orderId,
    merchant_prepare_id,
    amount,
    action,
    sign_time,
  } = data;
  const prepareId = merchant_prepare_id || "";
  const signature = `${click_trans_id}${service_id}${CLICK_SECRET_KEY}${orderId}${prepareId}${amount}${action}${sign_time}`;
  const signatureHash = md5(signature);
  return signatureHash === signString;
};

// Click response yuborish
const sendClickResponse = (result, res) => {
  res
    .set({
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    })
    .send(result);
};

// Click Prepare endpoint
router.post("/prepare", async (req, res) => {
  try {
    const data = req.body;
    const {
      click_trans_id,
      service_id,
      merchant_trans_id,
      amount,
      action,
      sign_time,
      sign_string,
    } = data;

    console.log(
      `✅ Prepare so'rov keldi: merchant_trans_id=${merchant_trans_id}, amount=${amount}`
    );

    // Tokenni tekshirish
    const signatureData = {
      click_trans_id,
      service_id,
      orderId: merchant_trans_id,
      amount,
      action,
      sign_time,
    };
    const isValid = clickCheckToken(signatureData, sign_string);

    if (!isValid) {
      console.log("❌ Prepare: Invalid signature");
      return sendClickResponse(
        {
          error: -1,
          error_note: "Invalid sign",
        },
        res
      );
    }

    // Payment tekshirish
    const payment = await paymentModel.findById(merchant_trans_id);
    if (!payment) {
      console.log("❌ Prepare: Payment topilmadi");
      return sendClickResponse(
        {
          error: -5,
          error_note: "User not found",
        },
        res
      );
    }

    // Amount tekshirish
    if (Number(amount) !== payment.amount) {
      console.log("❌ Prepare: Invalid amount");
      return sendClickResponse(
        {
          error: -2,
          error_note: "Invalid amount",
        },
        res
      );
    }

    const time = new Date().getTime();
    console.log(`✅ Prepare muvaffaqiyatli: merchant_prepare_id=${time}`);

    return sendClickResponse(
      {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: time,
        error: 0,
        error_note: "Success",
      },
      res
    );
  } catch (error) {
    console.error("❌ Prepare xatolik:", error);
    return sendClickResponse(
      {
        error: -9,
        error_note: "Technical error",
      },
      res
    );
  }
});

// Click Complete endpoint
router.post("/complete", async (req, res) => {
  try {
    const data = req.body;
    const {
      click_trans_id,
      service_id,
      merchant_trans_id,
      merchant_prepare_id,
      amount,
      action,
      sign_time,
      sign_string,
      error,
    } = data;

    console.log(
      `✅ Complete so'rov keldi: merchant_trans_id=${merchant_trans_id}, amount=${amount}`
    );

    const signatureData = {
      click_trans_id,
      service_id,
      orderId: merchant_trans_id,
      merchant_prepare_id,
      amount,
      action,
      sign_time,
    };
    const isValid = clickCheckToken(signatureData, sign_string);

    if (!isValid) {
      console.log("❌ Complete: Invalid signature");
      return sendClickResponse(
        {
          error: -1,
          error_note: "Invalid sign",
        },
        res
      );
    }

    const payment = await paymentModel.findById(merchant_trans_id);
    if (!payment) {
      console.log("❌ Complete: Payment topilmadi");
      return sendClickResponse(
        {
          error: -5,
          error_note: "User not found",
        },
        res
      );
    }

    // Agar allaqachon to'langan bo'lsa
    if (payment.status === "paid") {
      console.log("❌ Complete: Allaqachon to'langan");
      return sendClickResponse(
        {
          error: -4,
          error_note: "Already paid",
        },
        res
      );
    }

    // To'lovni amalga oshirish
    console.log("💾 To'lovni amalga oshirish...");

    const currentDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(currentDate.getMonth() + 1); // 1 oy

    // Payment holatini yangilash
    await paymentModel.findByIdAndUpdate(merchant_trans_id, {
      status: "paid",
      clickTransactionId: click_trans_id,
      planStartDate: currentDate,
      planEndDate: expiryDate,
    });

    // User planini PRO ga o'zgartirish
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

    console.log(`✅ User ${payment.userId} PRO planga o'tkazildi`);

    const time = new Date().getTime();
    console.log(
      `✅ Complete muvaffaqiyatli tugallandi: merchant_confirm_id=${time}`
    );

    return sendClickResponse(
      {
        click_trans_id,
        merchant_trans_id,
        merchant_confirm_id: time,
        error: 0,
        error_note: "Success",
      },
      res
    );
  } catch (error) {
    console.error("❌ Complete umumiy xatolik:", error);
    return sendClickResponse(
      {
        error: -9,
        error_note: "Technical error",
      },
      res
    );
  }
});

export default router;
