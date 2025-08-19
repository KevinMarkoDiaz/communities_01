// scripts/migrate-claimedCount.cjs
// Inicializa claimedCount=0 donde falte y (opcional) recalcula desde userpromos.
// Uso:
//   node scripts/migrate-claimedCount.cjs
//   node scripts/migrate-claimedCount.cjs --recount   # también recalcula desde userpromos

const path = require("path");
require("dotenv").config({ path: path.join(process.cwd(), ".env") });
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tuDB";

(async () => {
  try {
    console.log("[migrate] Conectando a:", MONGODB_URI);
    await mongoose.connect(MONGODB_URI);

    const db = mongoose.connection.db;
    const promotions = db.collection("promotions");
    const userPromos = db.collection("userpromos"); // nombre por defecto de la colección de UserPromo

    // Paso 1: set claimedCount=0 donde no exista o esté null
    const res1 = await promotions.updateMany(
      { $or: [{ claimedCount: { $exists: false } }, { claimedCount: null }] },
      { $set: { claimedCount: 0 } }
    );
    console.log(
      `[migrate] Paso1 -> matched: ${res1.matchedCount}, modified: ${res1.modifiedCount}`
    );

    // Paso 2 opcional: recalcular claimedCount a partir de userpromos
    if (process.argv.includes("--recount")) {
      console.log("[migrate] Paso2 -> recalculando desde userpromos...");
      const cursor = userPromos.aggregate([
        { $group: { _id: "$promotion", count: { $sum: 1 } } },
      ]);

      const ops = [];
      for await (const doc of cursor) {
        if (!doc._id) continue;
        ops.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { claimedCount: doc.count } },
          },
        });
        if (ops.length >= 1000) {
          const bulk = await promotions.bulkWrite(ops);
          console.log("[migrate] bulk updated:", bulk.modifiedCount);
          ops.length = 0;
        }
      }
      if (ops.length) {
        const bulk = await promotions.bulkWrite(ops);
        console.log("[migrate] bulk updated:", bulk.modifiedCount);
      }
    }

    // Paso 3: asegurar índice único (user+promotion) en userpromos (por si falta)
    try {
      await userPromos.createIndex({ user: 1, promotion: 1 }, { unique: true });
      console.log("[migrate] Índice único (user, promotion) OK.");
    } catch (e) {
      console.log(
        "[migrate] No se pudo crear índice (posible duplicado/ya existe):",
        e.message
      );
    }

    console.log("[migrate] ✅ Listo.");
  } catch (err) {
    console.error("[migrate] ❌ Error:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
