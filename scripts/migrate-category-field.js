// scripts/migrate-category-field.js

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const businessCollection = "businesses";

async function migrateCategoryToCategories() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB");

    const db = mongoose.connection.db;
    const businesses = await db
      .collection(businessCollection)
      .find({ category: { $exists: true } })
      .toArray();

    console.log(`🔍 Encontrados ${businesses.length} negocios con 'category'`);

    let updatedCount = 0;

    for (const business of businesses) {
      const category = business.category;

      if (category) {
        await db.collection(businessCollection).updateOne(
          { _id: business._id },
          {
            $set: { categories: [category.toString()] },
            $unset: { category: "" },
          }
        );
        console.log(`✅ Migrado: ${business.name || business._id}`);
        updatedCount++;
      }
    }

    console.log(`🎉 Migración completada. Total migrados: ${updatedCount}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en la migración:", error);
    process.exit(1);
  }
}

migrateCategoryToCategories();
