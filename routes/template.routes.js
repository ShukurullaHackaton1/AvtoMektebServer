import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import templatesModel from "../models/templates.model.js";
import userModel from "../models/user.model.js";
import historiesModel from "../models/histories.model.js";
import {
  checkTestLimit,
  updateTestCount,
} from "../middlewares/planMiddleware.js";

const router = express.Router();

// Barcha template lar ro'yxatini olish - AUTH TALAB QILMASLIK
router.get("/lists/:lang", async (req, res) => {
  try {
    const { lang } = req.params;

    // Lang validatsiyasi
    if (!["uz", "ru", "kiril", "uz_kiril", "kaa"].includes(lang)) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday turdagi malumot topilmadi" });
    }

    // uz_kiril ni kiril ga o'zgartiramiz
    const searchLang = lang === "uz_kiril" ? "kiril" : lang;

    // Faqat kerakli fieldlarni olish + lean() bilan tezlashtirish
    const findTemplates = await templatesModel
      .find({ templateLang: searchLang })
      .select(
        "templateLang template.exam_center_test_template.id template.title template.questions"
      )
      .lean();

    // Kerakli ma'lumotlarni tayyorlash
    const selectedTemplateDetails = findTemplates.map((item) => ({
      id: item.template.exam_center_test_template.id,
      title:
        item.template.title ||
        `Shablon ${item.template.exam_center_test_template.id}`,
      questionCount: item.template.questions?.length || 0,
      templateLang: item.templateLang,
    }));

    res.status(200).json({
      status: "success",
      data: selectedTemplateDetails,
    });
  } catch (error) {
    console.error("Templates list error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Bitta template ni olish - TEST LIMIT TEKSHIRISH
router.get(
  "/template/:lang/:templateId",
  authMiddleware,
  checkTestLimit,
  async (req, res) => {
    try {
      const { lang, templateId } = req.params;

      if (!["uz", "ru", "kiril", "uz_kiril", "kaa"].includes(lang)) {
        return res.status(400).json({
          status: "error",
          message: "Bunday turdagi malumot topilmadi",
        });
      }

      // uz_kiril ni kiril ga o'zgartiramiz
      const searchLang = lang === "uz_kiril" ? "kiril" : lang;

      const findTemplate = await templatesModel.findOne({
        templateLang: searchLang,
        "template.exam_center_test_template.id": Number(templateId),
      });

      if (!findTemplate) {
        return res
          .status(404)
          .json({ status: "error", message: "Shablon topilmadi" });
      }

      // Foydalanuvchi plan ma'lumotlarini qo'shish
      const user = req.user;
      const limitInfo = user.canTakeTest();

      // answers ichidagi check maydonini olib tashlash
      const filteredTemplate = {
        ...findTemplate._doc,
        template: {
          ...findTemplate._doc.template,
          questions: findTemplate._doc.template.questions.map((question) => ({
            ...question,
            answers: question.answers.map(({ check, ...rest }) => rest),
          })),
        },
      };

      res.status(200).json({
        status: "success",
        data: filteredTemplate,
        userPlan: {
          plan: user.plan,
          lifetimeUsed: user.lifetimeTestsUsed,
          remaining: limitInfo.remaining,
          limit: limitInfo.limit || "unlimited",
        },
      });
    } catch (error) {
      console.error("Template olishda xatolik:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

// Javobni tekshirish
router.post("/check-answer", authMiddleware, async (req, res) => {
  try {
    const { templateLang, templateId, questionId, selectedAnswer } = req.body;
    const { userId } = req.userData;

    // uz_kiril ni kiril ga o'zgartiramiz
    const searchLang = templateLang === "uz_kiril" ? "kiril" : templateLang;

    const findTemplate = await templatesModel.findOne({
      templateLang: searchLang,
      "template.exam_center_test_template.id": Number(templateId),
    });

    if (!findTemplate) {
      return res
        .status(400)
        .json({ status: "error", message: "Shablon topilmadi" });
    }

    const question = findTemplate.template.questions.find(
      (q) => q.id === Number(questionId)
    );

    if (!question) {
      return res
        .status(400)
        .json({ status: "error", message: "Savol topilmadi" });
    }

    const correctAnswer = question.answers.find((ans) => ans.check === 1);
    const selectedAnswerObj = question.answers.find(
      (ans) => ans.id === Number(selectedAnswer)
    );
    const isCorrect = correctAnswer.id === Number(selectedAnswer);

    // Test count va statistikani yangilash
    await updateTestCount(userId, isCorrect);

    // Noto'g'ri javob bo'lsa tarixga saqlash
    if (!isCorrect) {
      await historiesModel.create({
        userId,
        templateLang: searchLang,
        templateId: Number(templateId),
        answerId: Number(questionId),
        selectVariant: Number(selectedAnswer),
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        isCorrect,
        correctAnswer: {
          id: correctAnswer.id,
          text: correctAnswer.body.map((b) => b.value).join(" "),
        },
        selectedAnswer: {
          id: selectedAnswerObj.id,
          text: selectedAnswerObj.body.map((b) => b.value).join(" "),
        },
        explanation: question.explanation || null,
      },
    });
  } catch (error) {
    console.error("Check answer error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// User plan ma'lumotlarini olish
router.get("/user-plan", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await userModel
      .findById(userId)
      .select("plan lifetimeTestsUsed planExpiryDate");

    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "Foydalanuvchi topilmadi" });
    }

    const limitInfo = user.canTakeTest();

    res.status(200).json({
      status: "success",
      data: {
        plan: user.plan,
        lifetimeUsed: user.lifetimeTestsUsed,
        remaining: limitInfo.remaining,
        limit: limitInfo.limit || "unlimited",
        canTakeTest: limitInfo.canTake,
        planExpiryDate: user.planExpiryDate,
      },
    });
  } catch (error) {
    console.error("User plan error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Xatolar tarixini olish
router.get("/mistakes", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    // 1. Mistakelarni olamiz
    const mistakes = await historiesModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!mistakes.length) {
      return res.status(200).json({ status: "success", data: [] });
    }

    // 2. Barcha kerakli templateLang va templateId larni yig'amiz
    const templateConditions = mistakes.map((m) => ({
      templateLang: m.templateLang,
      "template.exam_center_test_template.id": m.templateId,
    }));

    // 3. Unikal qilish
    const uniqueConditions = [];
    const seen = new Set();
    for (const cond of templateConditions) {
      const key = `${cond.templateLang}-${cond["template.exam_center_test_template.id"]}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueConditions.push(cond);
      }
    }

    // 4. Barcha kerakli template'larni bitta query bilan olish
    const templates = await templatesModel
      .find({ $or: uniqueConditions })
      .select("templateLang template")
      .lean();

    // 5. Tez topish uchun map qilish
    const templateMap = new Map();
    for (const tpl of templates) {
      const tplId = tpl.template.exam_center_test_template.id;
      templateMap.set(`${tpl.templateLang}-${tplId}`, tpl);
    }

    // 6. Mistake details yig'ish
    const mistakeDetails = [];

    for (const mistake of mistakes) {
      const key = `${mistake.templateLang}-${mistake.templateId}`;
      const template = templateMap.get(key);
      if (!template) continue;

      const question = template.template.questions.find(
        (q) => q.id === mistake.answerId
      );

      if (!question) continue;

      const correctAnswer = question.answers.find((ans) => ans.check === 1);
      const userAnswer = question.answers.find(
        (ans) => ans.id === mistake.selectVariant
      );

      mistakeDetails.push({
        id: mistake._id,
        templateId: mistake.templateId,
        templateLang: mistake.templateLang,
        templateTitle:
          template.template.title || `Shablon ${mistake.templateId}`,
        question: question,
        userAnswer: userAnswer
          ? {
              id: userAnswer.id,
              text: userAnswer.body.map((b) => b.value).join(" "),
            }
          : null,
        correctAnswer: correctAnswer
          ? {
              id: correctAnswer.id,
              text: correctAnswer.body.map((b) => b.value).join(" "),
            }
          : null,
        date: mistake.createdAt,
      });
    }

    res.status(200).json({ status: "success", data: mistakeDetails });
  } catch (error) {
    console.error("Mistakes error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
