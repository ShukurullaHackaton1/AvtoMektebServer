import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import eduTypesModel from "../models/edu-types.model.js";
import lessonsModel from "../models/lessons.model.js";
import topicsModel from "../models/topics.model.js";
import contentsModel from "../models/contents.model.js";

const router = express.Router();

router.get("/list", authMiddleware, async (req, res) => {
  try {
    const eduTypes = await eduTypesModel.find();

    res.status(200).json({ status: "success", data: eduTypes });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/lesson/:eduId", authMiddleware, async (req, res) => {
  try {
    const findEdu = await eduTypesModel.findById(req.params.eduId);
    if (!findEdu) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday darslik turi topilmadi" });
    }

    const findLessons = await lessonsModel.find({
      edu_type_id: req.params.eduId,
    });

    res.status(200).json({ status: "success", data: findLessons });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/topic/:lessonId", authMiddleware, async (req, res) => {
  try {
    const findLessons = await lessonsModel.findById(req.params.lessonId);
    if (!findLessons) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday lesson topilmadi" });
    }
    const findTopics = await topicsModel.find({
      "topic.edu_type_lesson_id": req.params.lessonId,
    });
    res.status(200).json({ status: "success", data: findTopics });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/content/:topicId", authMiddleware, async (req, res) => {
  try {
    const findTopic = await topicsModel.findById(req.params.topicId);
    if (!findTopic) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday topic topilmadi" });
    }
    const findContents = await contentsModel.find({
      "content.topic_id": req.params.topicId,
    });

    res.status(200).json({ status: "success", data: findContents });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
