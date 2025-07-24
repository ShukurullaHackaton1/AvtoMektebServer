import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import templatesModel from "../models/templates.model.js";
import userModel from "../models/user.model.js";
import historiesModel from "../models/histories.model.js";

const router = express.Router();

router.get("/lists/:lang", authMiddleware, async (req, res) => {
  try {
    const { lang } = req.params;
    if (lang !== "uz" || lang !== "ru" || lang !== "kiril") {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday turdagi malumot topilmadi" });
    }

    const findTemplates = await templatesModel.find({ templateLang: lang });

    const selectedTemplateDetails = findTemplates.map((item) => {
      return {
        template: { exam_center_test_template: item.exam_center_test_template },
        templateLang: item.templateLang,
      };
    });

    res.status(200).json({ status: "success", data: selectedTemplateDetails });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.get("/template/:lang/:templateId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.userData;

    const user = await userModel.findById(userId);

    if (user.plan == "starter" && user.plan.usageRate == 3) {
      return res.status(400).json({
        status: "error",
        message:
          "Sizda test ishlash uchun limit tugagan. Iltimos pullik xizmatdan foydalaning",
      });
    }

    if (!user) {
      return res
        .status(401)
        .json({ status: "error", message: "Bunday foydalanuvchi topilmadi" });
    }

    const findTemplate = await templatesModel.findOne({
      templateLang: req.params.lang,
      "template.exam_center_test_template.id": req.params.templateId,
    });

    res.status(200).json({ status: "success", data: findTemplate });

    await userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          plan: {
            usageRate: user.plan.usageRate + 1,
          },
        },
      },
      { new: true }
    );
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

router.post("/template/:lang/:templateId", authMiddleware, async (req, res) => {
  try {
    const { answerId, selectVariant } = req.body;

    const { userId } = req.userData;

    const { lang, templateId } = req.params;

    const findTemplate = await templatesModel
      .findOne({
        templateLang: lang,
        "template.exam_center_test_template.id": templateId,
      })
      .select("template.questions");

    if (!findTemplate) {
      return res
        .status(400)
        .json({ status: "error", message: "Bunday Shablon topilmadi" });
    }

    const answer = findTemplate.find((c) => c.id == answerId)?.answers;

    if (!answer) {
      return res
        .status(400)
        .json({ status: "error", message: "bunday savol topilmadi" });
    }

    const isTrue =
      answer.find((c) => c.id == selectVariant).check == 1 ? true : false;

    if (isTrue == false) {
      await historiesModel.create({
        userId,
        templateLang,
        templateId,
        answerId,
        selectVariant,
      });
    }

    res.status(200).json({ status: "success", data: isTrue });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
