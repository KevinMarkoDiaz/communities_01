// models/Community.js
import mongoose from "mongoose";
import { generateUniqueSlug } from "../utils/uniqueSlug.js";

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    flagImage: String,
    bannerImage: String,

    description: { type: String, maxlength: 1000 },
    language: { type: String, default: "es" },
    tipo: { type: String, default: "migrante" },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    negocios: [{ type: mongoose.Schema.Types.ObjectId, ref: "Business" }],
    eventos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],

    memberCount: { type: Number, default: 0 },
    businessCount: { type: Number, default: 0 },
    eventCount: { type: Number, default: 0 },
    mostPopularCategory: String,

    populationEstimate: Number,
    originCountryInfo: {
      name: String,
      flag: String,
      capital: String,
    },
    traditions: [String],
    food: [
      {
        name: String,
        description: String,
        image: String,
      },
    ],

    featuredBusinesses: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
    ],
    featuredEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Event" }],
    testimonials: [{ name: String, message: String, avatar: String }],
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // 📎 Recursos
    resources: [
      {
        title: String,
        url: String,
        type: {
          type: String,
          enum: ["legal", "salud", "educación", "otros"],
        },
      },
    ],
    socialMediaLinks: {
      facebook: String,
      instagram: String,
      whatsapp: String,
      youtube: String,
    },

    // ✅ Enlaces externos relevantes
    externalLinks: [
      {
        title: String,
        url: String,
        type: {
          type: String,
          enum: ["facebook", "instagram", "whatsapp", "otro"],
          default: "otro",
        },
        description: String,
      },
    ],

    region: String,
    mapCenter: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },

    metaTitle: String,
    metaDescription: String,

    status: {
      type: String,
      enum: ["Inactiva", "Pendiente", "Publicada"],
      default: "Inactiva",
    },
    verified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

communitySchema.index({ mapCenter: "2dsphere" });

// 🔒 Hook: crea/normaliza slug y lo regenera si cambia el name
communitySchema.pre("validate", async function () {
  if (!this.name) return;

  // normaliza slug si viene seteado manualmente
  if (this.slug) {
    this.slug = this.slug.toString().trim().toLowerCase();
  }

  // genera si falta o si cambió el nombre
  if (!this.slug || this.isModified("name")) {
    this.slug = await generateUniqueSlug(this.name, this._id);
  }
});

const Community = mongoose.model("Community", communitySchema);
export default Community;
