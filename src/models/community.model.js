// models/Community.js

import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, unique: true },

    flagImage: { type: String },
    bannerImage: { type: String },

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
    mostPopularCategory: { type: String },

    populationEstimate: { type: Number },
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
    testimonials: [
      {
        name: String,
        message: String,
        avatar: String,
      },
    ],
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

    // ✅ NUEVO: Enlaces externos relevantes
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

const Community = mongoose.model("Community", communitySchema);
export default Community;
