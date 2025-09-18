// import fs from "fs";
// import templatesModel from "./models/templates.model.js";

// // Json faylni o'qish
// const jsonData = JSON.parse(fs.readFileSync("./kaa_kiril.json", "utf8"));

// const uploadJsonToMongo = async () => {
//   try {
//     // Umumiy massivni tekshirish
//     if (!Array.isArray(jsonData)) {
//       throw new Error("Json fayl umumiy massiv formatida emas");
//     }

//     let templateCounter = 0; // Template hisoblagichi

//     // Umumiy massivni iteratsiya qilish
//     for (const data of jsonData) {
//       // Questions massivini tekshirish
//       if (!data.questions || !Array.isArray(data.questions)) {
//         console.warn(
//           `Ma'lumotda 'questions' massivi topilmadi yoki to'g'ri formatda emas: ${JSON.stringify(
//             data
//           )}`
//         );
//         continue; // Agar questions massivi bo'lmasa, keyingi obyektga o'tish
//       }

//       templateCounter++;
//       const isFirstThreeTemplates = templateCounter <= 3;

//       // Questions massivini klonlash va o'zgartirish
//       const modifiedQuestions = data.questions.map((question) => {
//         const questionCopy = JSON.parse(JSON.stringify(question)); // Deep copy

//         // body dagi rasm URLlarini o'zgartirish
//         questionCopy.body = questionCopy.body.map((item) => {
//           if (item.type === 2 && item.value) {
//             // Fayl kengaytmasini olish (jpg, png va hokazo)
//             const extension = item.value.split(".").pop();

//             if (isFirstThreeTemplates) {
//               // Birinchi 3 ta template uchun ru-test-images
//               item.value = `ru-test-images/${question.id}.${extension}`;
//             } else {
//               // Qolgan templatelar uchun uz-test-images
//               item.value = `uz-test-images/${question.id}.${extension}`;
//             }
//           }
//           return item;
//         });

//         return questionCopy;
//       });

//       // Template obyektini yaratish - barcha questionlarni bir templateda saqlash
//       const newTemplate = new templatesModel({
//         template: {
//           questions: modifiedQuestions, // Barcha savollarni bir templateda saqlash
//           exam_center_test_template: data.exam_center_test_template,
//           saved_test: data.saved_test,
//         },
//         templateLang: "kaa",
//       });

//       // MongoDB ga saqlash
//       await newTemplate.save();
//       console.log(
//         `Template ${templateCounter} (${
//           modifiedQuestions.length
//         } ta savol bilan) muvaffaqiyatli saqlandi. Rasm yo'li: ${
//           isFirstThreeTemplates ? "ru-test-images" : "uz-test-images"
//         }`
//       );
//     }

//     console.log(`Jami ${templateCounter} ta template muvaffaqiyatli yuklandi`);
//   } catch (error) {
//     console.error("Xato yuz berdi:", error.message);
//   } finally {
//     console.log("MongoDB ulanishi yopildi");
//   }
// };

// export default uploadJsonToMongo;
