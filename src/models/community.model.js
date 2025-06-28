import mongoose from "mongoose";

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, unique: true }, // URL amigable opcional

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

    // 🔢 Métricas y estadística
    memberCount: { type: Number, default: 0 },
    businessCount: { type: Number, default: 0 },
    eventCount: { type: Number, default: 0 },
    mostPopularCategory: { type: String },

    // 🌍 Info cultural y social
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

    // ⭐ Engagement
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

    // 🌐 Geolocalización
    region: String,
    mapCenter: {
      lat: Number,
      lng: Number,
    },

    // 🔍 SEO
    metaTitle: String,
    metaDescription: String,

    // ⚙️ Estado
    status: {
      type: String,
      enum: ["Inactiva", "Pendiente", "Publicada"],
      default: "Inactiva",
    },
    verified: { type: Boolean, default: false },

    // ⏱️ Timestamps
  },
  { timestamps: true }
);

const Community = mongoose.model("Community", communitySchema);
export default Community;
