import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import templatesModel from "../models/templates.model.js";
import userModel from "../models/user.model.js";
import historiesModel from "../models/histories.model.js";

const router = express.Router();

// Barcha template lar ro'yxatini olish
router.get("/lists/:lang", async (req, res) => {
  try {
    const { lang } = req.params;

    if (!["uz", "ru", "kiril", "uz_kiril", "kaa"].includes(lang)) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday turdagi malumot topilmadi" });
    }

    // uz_kiril ni kiril ga o'zgartiramiz
    const searchLang = lang === "uz_kiril" ? "kiril" : lang;

    const findTemplates = await templatesModel.find({
      templateLang: searchLang,
    });

    const selectedTemplateDetails = findTemplates.map((item) => {
      return {
        id: item.template.exam_center_test_template.id,
        title:
          item.template.title ||
          `Shablon ${item.template.exam_center_test_template.id}`,
        questionCount: item.template.questions?.length || 0,
        templateLang: item.templateLang,
      };
    });

    res.status(200).json({
      status: "success",
      data: selectedTemplateDetails,
    });
  } catch (error) {
    console.error("Templates list error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Bitta template ni olish
router.get("/template/:lang/:templateId", async (req, res) => {
  try {
    const { lang, templateId } = req.params;

    if (!["uz", "ru", "kiril", "uz_kiril", "kaa"].includes(lang)) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday turdagi malumot topilmadi" });
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

    res.status(200).json({ status: "success", data: findTemplate });
  } catch (error) {
    console.error("Template olishda xatolik:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

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

    // Statistikani yangilash
    await userModel.findByIdAndUpdate(userId, {
      $inc: {
        totalTests: 1,
        ...(isCorrect ? { totalCorrect: 1 } : { totalWrong: 1 }),
      },
    });

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

// Xatolar tarixini olish
router.get("/mistakes", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const mistakes = await historiesModel
      .find({ userId })
      .sort({ createdAt: -1 });

    const mistakeDetails = [];

    for (const mistake of mistakes) {
      const template = await templatesModel.findOne({
        templateLang: mistake.templateLang,
        "template.exam_center_test_template.id": mistake.templateId,
      });

      if (template) {
        const question = template.template.questions.find(
          (q) => q.id === mistake.answerId
        );

        if (question) {
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
            userAnswer: {
              id: userAnswer.id,
              text: userAnswer.body.map((b) => b.value).join(" "),
            },
            correctAnswer: {
              id: correctAnswer.id,
              text: correctAnswer.body.map((b) => b.value).join(" "),
            },
            date: mistake.createdAt,
          });
        }
      }
    }

    res.status(200).json({ status: "success", data: mistakeDetails });
  } catch (error) {
    console.error("Mistakes error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
