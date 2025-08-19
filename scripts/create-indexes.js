// scripts/create-indexes.js
import mongoose from "mongoose";
import "dotenv/config";

const uri = process.env.MONGO_URI; // ej: mongodb+srv://user:pass@cluster
const dbName = process.env.MONGO_DB || undefined;

async function main() {
  await mongoose.connect(uri, { dbName });
  const db = mongoose.connection.db;

  await Promise.all([
    db
      .collection("businesses")
      .createIndex({ community: 1 }, { name: "biz_community_1" }),
    db
      .collection("businesses")
      .createIndex({ isPremium: 1 }, { name: "biz_isPremium_1" }),

    db
      .collection("events")
      .createIndex({ communities: 1 }, { name: "evt_communities_1" }),
    db.collection("events").createIndex({ date: 1 }, { name: "evt_date_1" }),
    db
      .collection("events")
      .createIndex({ isPremium: 1 }, { name: "evt_isPremium_1" }),

    db
      .collection("promotions")
      .createIndex({ community: 1 }, { name: "pro_community_1" }),
    db
      .collection("promotions")
      .createIndex({ startDate: 1, endDate: 1 }, { name: "pro_dates_1" }),
    db
      .collection("promotions")
      .createIndex({ isPremium: 1 }, { name: "pro_isPremium_1" }),

    db
      .collection("businesses")
      .createIndex(
        { "location.coordinates": "2dsphere" },
        { name: "biz_loc_2dsphere" }
      ),
    db
      .collection("events")
      .createIndex(
        { coordinates: "2dsphere" },
        { name: "evt_coordinates_2dsphere" }
      ),
  ]);

  console.log("✅ Índices creados");
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
