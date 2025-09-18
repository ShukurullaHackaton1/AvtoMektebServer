import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import { checkProPlanOptional } from "../middlewares/planMiddleware.js";
import templatesModel from "../models/templates.model.js";
import userModel from "../models/user.model.js";
import historiesModel from "../models/histories.model.js";

const router = express.Router();

// Exam sessiyalarini saqlash uchun (memory da)
const examSessions = new Map();

router.post(
  "/create-exam",
  authMiddleware,
  checkProPlanOptional,
  async (req, res) => {
    try {
      const { language, questionCount } = req.body;
      const { userId } = req.userData;

      // Validation
      if (!["uz", "ru", "kiril", "uz_kiril", "kaa"].includes(language)) {
        return res.status(400).json({
          status: "error",
          message: "Noto'g'ri til tanlandi",
        });
      }

      if (![20, 50].includes(questionCount)) {
        return res.status(400).json({
          status: "error",
          message: "Test soni 20 yoki 50 bo'lishi kerak",
        });
      }

      // uz_kiril ni kiril ga o'zgartirish
      const searchLang = language === "uz_kiril" ? "kiril" : language;

      // Shu tildagi barcha templatelarni olish
      const templates = await templatesModel
        .find({ templateLang: searchLang })
        .select("template.questions")
        .lean();

      if (templates.length === 0) {
        return res.status(404).json({
          status: "error",
          message: "Ushbu tilda templatelar topilmadi",
        });
      }

      // Barcha savollarni bir joyga yig'ish va template indexlarini saqlash
      let allQuestions = [];
      templates.forEach((template) => {
        if (template.template?.questions) {
          template.template.questions.forEach((question) => {
            allQuestions.push({
              ...question,
              originalTemplateId: template._id,
            });
          });
        }
      });

      // Yetarli savol borligini tekshirish
      if (allQuestions.length < questionCount) {
        return res.status(400).json({
          status: "error",
          message: `Ushbu tilda faqat ${allQuestions.length} ta savol mavjud`,
        });
      }

      // Fisher-Yates shuffle algorithm bilan random tanlash
      const shuffled = [...allQuestions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const selectedQuestions = shuffled.slice(0, questionCount);

      // Exam vaqtini hisoblash
      const examDuration =
        questionCount === 20 ? 20 * 60 * 1000 : 45 * 60 * 1000; // 20 yoki 45 daqiqa

      // Exam session yaratish
      const examId = `exam_${userId}_${Date.now()}`;
      const examSession = {
        examId,
        userId,
        language: searchLang,
        questionCount,
        questions: selectedQuestions,
        answers: {}, // questionId -> answerId
        results: {}, // questionId -> boolean
        startTime: new Date(),
        endTime: null,
        currentQuestion: 0,
        status: "active", // active, completed, expired
        duration: examDuration,
        expiresAt: new Date(Date.now() + examDuration),
      };

      examSessions.set(examId, examSession);

      // Auto expire based on exam duration
      setTimeout(() => {
        const session = examSessions.get(examId);
        if (session && session.status === "active") {
          session.status = "expired";
          session.endTime = new Date();
          // Auto-complete exam
          completeExamSession(examId, userId);
        }
      }, examDuration);

      res.json({
        status: "success",
        data: {
          examId,
          questionCount: selectedQuestions.length,
          language: searchLang,
          startTime: examSession.startTime,
          duration: examDuration / 60000, // Convert to minutes
          expiresAt: examSession.expiresAt,
          currentQuestion: 0,
          totalQuestions: selectedQuestions.length,
        },
      });
    } catch (error) {
      console.error("Create exam error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

async function completeExamSession(examId, userId) {
  try {
    const session = examSessions.get(examId);
    if (!session) return;

    // Natijalarni hisoblash
    const totalQuestions = session.questions.length;
    const answeredQuestions = Object.keys(session.results).length;
    const correctAnswers = Object.values(session.results).filter(
      Boolean
    ).length;
    const wrongAnswers = answeredQuestions - correctAnswers;

    // User statistikasini yangilash
    const user = await userModel.findById(userId);
    if (user) {
      user.incrementTestCount();
      user.totalCorrect += correctAnswers;
      user.totalWrong += wrongAnswers;
      await user.save();
    }

    // Xatolarni histories ga saqlash
    for (const [questionId, isCorrect] of Object.entries(session.results)) {
      if (!isCorrect) {
        const question = session.questions.find(
          (q) => q.id === parseInt(questionId)
        );
        if (question) {
          await historiesModel.create({
            userId,
            templateLang: session.language,
            templateId: 999, // Exam uchun maxsus ID
            answerId: parseInt(questionId),
            selectVariant: session.answers[questionId] || 0,
          });
        }
      }
    }

    // Session ni o'chirish
    setTimeout(() => {
      examSessions.delete(examId);
    }, 30 * 60 * 1000); // 30 daqiqadan keyin o'chirish
  } catch (error) {
    console.error("Complete exam session error:", error);
  }
}
// Exam savol olish
router.get(
  "/question/:examId/:questionIndex",
  authMiddleware,
  async (req, res) => {
    try {
      const { examId, questionIndex } = req.params;
      const { userId } = req.userData;

      const session = examSessions.get(examId);

      if (!session || session.userId !== userId) {
        return res.status(404).json({
          status: "error",
          message: "Exam topilmadi",
        });
      }

      if (session.status !== "active") {
        return res.status(400).json({
          status: "error",
          message: "Exam tugagan yoki muddati o'tgan",
        });
      }

      const qIndex = parseInt(questionIndex);
      if (qIndex < 0 || qIndex >= session.questions.length) {
        return res.status(400).json({
          status: "error",
          message: "Noto'g'ri savol raqami",
        });
      }

      const question = session.questions[qIndex];
      const userAnswer = session.answers[question.id];
      const isAnswered = session.results.hasOwnProperty(question.id);

      res.json({
        status: "success",
        data: {
          question: {
            id: question.id,
            body: question.body,
            answers: question.answers,
          },
          questionIndex: qIndex,
          totalQuestions: session.questions.length,
          userAnswer,
          isAnswered,
          examInfo: {
            examId,
            language: session.language,
            questionCount: session.questionCount,
            startTime: session.startTime,
          },
        },
      });
    } catch (error) {
      console.error("Get exam question error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

// Exam javob berish
router.post("/answer/:examId", authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    const { questionId, selectedAnswer } = req.body;
    const { userId } = req.userData;

    const session = examSessions.get(examId);

    if (!session || session.userId !== userId) {
      return res.status(404).json({
        status: "error",
        message: "Exam topilmadi",
      });
    }

    if (session.status !== "active") {
      return res.status(400).json({
        status: "error",
        message: "Exam tugagan yoki muddati o'tgan",
      });
    }

    // Agar allaqachon javob berilgan bo'lsa
    if (session.results.hasOwnProperty(questionId)) {
      return res.status(400).json({
        status: "error",
        message: "Bu savolga allaqachon javob berilgan",
      });
    }

    // Savolni topish
    const question = session.questions.find(
      (q) => q.id === parseInt(questionId)
    );
    if (!question) {
      return res.status(400).json({
        status: "error",
        message: "Savol topilmadi",
      });
    }

    // To'g'ri javobni topish
    const correctAnswer = question.answers.find((ans) => ans.check === 1);
    const selectedAnswerObj = question.answers.find(
      (ans) => ans.id === parseInt(selectedAnswer)
    );
    const isCorrect = correctAnswer.id === parseInt(selectedAnswer);

    // Javobni saqlash
    session.answers[questionId] = parseInt(selectedAnswer);
    session.results[questionId] = isCorrect;

    res.json({
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
      },
    });
  } catch (error) {
    console.error("Exam answer error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Exam tugatish
router.post("/complete/:examId", authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    const { userId } = req.userData;

    const session = examSessions.get(examId);

    if (!session || session.userId !== userId) {
      return res.status(404).json({
        status: "error",
        message: "Exam topilmadi",
      });
    }

    if (session.status !== "active") {
      return res.status(400).json({
        status: "error",
        message: "Exam allaqachon tugagan",
      });
    }

    // Exam ni tugatish
    session.status = "completed";
    session.endTime = new Date();

    // Natijalarni hisoblash
    const totalQuestions = session.questions.length;
    const answeredQuestions = Object.keys(session.results).length;
    const correctAnswers = Object.values(session.results).filter(
      Boolean
    ).length;
    const wrongAnswers = answeredQuestions - correctAnswers;
    const unansweredQuestions = totalQuestions - answeredQuestions;
    const percentage =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;

    // User statistikasini yangilash - LIFETIME limit ni kamaytiramiz
    const user = await userModel.findById(userId);
    if (user) {
      user.incrementTestCount();
      user.totalCorrect += correctAnswers;
      user.totalWrong += wrongAnswers;
      await user.save();
    }

    // Session ni 1 soatdan keyin o'chirish
    setTimeout(() => {
      examSessions.delete(examId);
    }, 60 * 60 * 1000); // 1 soat

    res.json({
      status: "success",
      data: {
        examId,
        results: {
          totalQuestions,
          answeredQuestions,
          correctAnswers,
          wrongAnswers,
          unansweredQuestions,
          percentage,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: Math.round(
            (session.endTime - session.startTime) / 1000 / 60
          ), // minutes
        },
      },
    });
  } catch (error) {
    console.error("Complete exam error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// Exam status olish
router.get("/status/:examId", authMiddleware, async (req, res) => {
  try {
    const { examId } = req.params;
    const { userId } = req.userData;

    const session = examSessions.get(examId);

    if (!session || session.userId !== userId) {
      return res.status(404).json({
        status: "error",
        message: "Exam topilmadi",
      });
    }

    const answeredCount = Object.keys(session.results).length;
    const correctCount = Object.values(session.results).filter(Boolean).length;

    res.json({
      status: "success",
      data: {
        examId,
        examStatus: session.status,
        language: session.language,
        questionCount: session.questionCount,
        totalQuestions: session.questions.length,
        answeredQuestions: answeredCount,
        correctAnswers: correctCount,
        currentQuestion: session.currentQuestion,
        startTime: session.startTime,
        endTime: session.endTime,
      },
    });
  } catch (error) {
    console.error("Exam status error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
