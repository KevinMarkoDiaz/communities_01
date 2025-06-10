import mongoose from "mongoose";

const communitySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  flagImage: { type: String },
  bannerImage: { type: String }, // 🆕 imagen grande para la home
  description: { type: String },
  language: { type: String, default: "es" },
  tipo: { type: String, default: "migrante" }, // 🆕 puede ser "migrante", "cultural", etc.
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  negocios: [{ type: mongoose.Schema.Types.ObjectId, ref: "Business" }],
  eventos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
});

const Community = mongoose.model("Community", communitySchema);
export default Community;
