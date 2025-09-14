// scripts/backfill-business-slugs.js
import mongoose from "mongoose";
import slugify from "slugify";
import dotenv from "dotenv";
import Business from "../src/models/business.model.js"; // ajusta ruta según tu estructura

dotenv.config();

async function generateUniqueBizSlug(name, excludeId = null) {
  const base = slugify(name, { lower: true, strict: true });
  let slug = base;
  let i = 1;
  const cond = (s) =>
    excludeId ? { slug: s, _id: { $ne: excludeId } } : { slug: s };
  while (await Business.findOne(cond(slug)).select("_id")) {
    slug = `${base}-${i++}`;
  }
  return slug;
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ Missing MONGODB_URI env");
    process.exit(1);
  }
  await mongoose.connect(uri);

  const cursor = Business.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
  }).cursor();

  let updated = 0;
  for (let biz = await cursor.next(); biz != null; biz = await cursor.next()) {
    if (!biz.name) continue;
    biz.slug = await generateUniqueBizSlug(biz.name, biz._id);
    await biz.save();
    updated++;
    console.log(`✓ ${biz.name} -> ${biz.slug}`);
  }

  console.log(`\nDone. Updated ${updated} businesses.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
