import express from "express";
import { config } from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import templatesModel from "./models/templates.model.js";

config();
const app = express();

const port = process.env.PORT;
const mongo_uri = process.env.MONGO_URI;

// Fayl yo'lini belgilang
const filePath = "./template_kiril_uz.json";

// Rasm yo'lini o'zgartirish funksiyasi
const updateImagePaths = (data) => {
  return data.map((template) => {
    // Har bir shablon uchun
    const updatedTemplate = {
      ...template,
      questions: template.questions.map((question) => {
        // Har bir savol uchun
        const updatedQuestion = {
          ...question,
          body: question.body.map((bodyPart) => {
            // Agar bu rasm bo'lsa (type: 2)
            if (bodyPart.type === 2 && typeof bodyPart.value === "string") {
              // Yangi rasm yo'li: ru-test-images/${question_id}.jpg
              const fileExtension =
                bodyPart.value.split(".").pop().split("?")[0] || "jpg";
              const newImagePath = `kiril-test-images/${question.id}.${fileExtension}`;

              return {
                ...bodyPart,
                value: newImagePath,
              };
            }
            return bodyPart;
          }),
        };
        return updatedQuestion;
      }),
    };
    return updatedTemplate;
  });
};

// MongoDB ga qo'shish funksiyasi
const addMongodb = async (data, index) => {
  try {
    await templatesModel.create({
      template: data,
      templateLang: "kiril", // Rus tili uchun o'zgartirildi
    });
    console.log(
      `✅ ${index + 1}-shablon qo'shildi (${data.questions.length} ta savol)`
    );
  } catch (error) {
    console.error(`❌ ${index + 1}-shablon qo'shishda xatolik:`, error.message);
  }
};

// Faylni o'qish va MongoDB ga yuklash
const processFile = async () => {
  try {
    console.log("📖 JSON fayl o'qilmoqda...");

    const data = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(data);

    console.log(`📋 ${jsonData.length} ta shablon topildi`);

    // Rasm yo'llarini o'zgartirish
    console.log("🔄 Rasm yo'llari o'zgartirilmoqda...");
    const updatedData = updateImagePaths(jsonData);

    // Nechta rasm yo'li o'zgartirilganini hisoblash
    let totalImagesUpdated = 0;
    updatedData.forEach((template) => {
      template.questions.forEach((question) => {
        question.body.forEach((bodyPart) => {
          if (bodyPart.type === 2) {
            totalImagesUpdated++;
          }
        });
      });
    });

    console.log(`🖼️ ${totalImagesUpdated} ta rasm yo'li o'zgartirildi`);

    // MongoDB ga saqlash
    console.log("\n💾 MongoDB ga saqlanmoqda...");

    for (let i = 0; i < updatedData.length; i++) {
      await addMongodb(updatedData[i], i);

      // Har 10 ta shablondan keyin kichik pauza
      if ((i + 1) % 10 === 0) {
        console.log(`📊 ${i + 1}/${updatedData.length} shablon yuklandi...`);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log("\n📊 YAKUNIY NATIJALAR:");
    console.log(`✅ Jami yuklangan shablonlar: ${updatedData.length}`);
    console.log(`🖼️ O'zgartirilgan rasm yo'llari: ${totalImagesUpdated}`);
    console.log(`🌐 Til: Kiril`);
    console.log(`📁 Rasm papkasi: kiril-test-images/`);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error("❌ Fayl topilmadi:", filePath);
    } else if (err instanceof SyntaxError) {
      console.error("❌ JSON ni parse qilishda xatolik:", err.message);
    } else {
      console.error("❌ Umumiy xatolik:", err.message);
    }
  }
};

// MongoDB ga ulanish
mongoose
  .connect(mongo_uri)
  .then(async () => {
    console.log("✅ Database ulandi");
    // Fayl ishlov berish va MongoDB ga yuklash
    // processFile();

    // const uzTemplates = await templatesModel.find({ templateLang: "ru" });
    // console.log(uzTemplates);
  })
  .catch((error) => {
    console.error("❌ Database ulanishida xatolik:", error);
  });

// Server ishga tushirish
app.listen(port, () => {
  console.log(`🚀 Server ${port} portda ishga tushdi`);
});
