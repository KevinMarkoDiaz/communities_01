// // scripts/backfillCommunitySlugs.js
// import mongoose from "mongoose";
// import Community from "../models/community.model.js";

// (async () => {
//   await mongoose.connect(process.env.MONGO_URI);
//   const list = await Community.find({
//     $or: [{ slug: { $exists: false } }, { slug: "" }],
//   });
//   for (const c of list) {
//     // disparará el hook y guardará slug
//     c.markModified("name");
//     await c.save();
//     console.log(`OK: ${c.name} -> ${c.slug}`);
//   }
//   await mongoose.disconnect();
//   process.exit(0);
// })();
// //
