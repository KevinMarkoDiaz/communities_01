// models/business.model.js
import mongoose from "mongoose";

const horarioSchema = new mongoose.Schema({
  day: { type: String, required: true },
  closed: { type: Boolean, default: false },
  open: {
    type: String,
    required: function () {
      return !this.closed;
    },
    validate: {
      validator(value) {
        if (this.closed) return true;
        return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
      },
      message: "Formato inválido para la hora de apertura (HH:mm)",
    },
  },
  close: {
    type: String,
    required: function () {
      return !this.closed;
    },
    validate: {
      validator(value) {
        if (this.closed) return true;
        return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
      },
      message: "Formato inválido para la hora de cierre (HH:mm)",
    },
  },
});

const socialMediaSchema = new mongoose.Schema({
  facebook: String,
  instagram: String,
  whatsapp: String,
});

const contactSchema = new mongoose.Schema({
  phone: String,
  email: { type: String, match: /.+\@.+\..+/ },
  website: String,
  socialMedia: socialMediaSchema,
});

const locationSchema = new mongoose.Schema({
  address: { type: String }, // ⚠️ ya no required aquí; validamos en el controlador
  city: { type: String },
  state: { type: String },
  zipCode: { type: String, default: "" },
  country: { type: String, default: "USA" },
  coordinates: {
    type: { type: String, enum: ["Point"], default: "Point", required: true },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length === 2;
        },
        message: "Las coordenadas deben tener [lng, lat]",
      },
    },
  },
});

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    categories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    ],
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },

    // NUEVO
    isDeliveryOnly: { type: Boolean, default: false },
    primaryZip: { type: String, default: "" }, // ZIP principal para el pin del mapa
    serviceAreaZips: [{ type: String }], // opcional, solo informativo
    locationPrecision: {
      type: String,
      enum: ["address", "zipcode"],
      default: "address",
    },

    contact: contactSchema,
    location: locationSchema, // si isDeliveryOnly === true, podemos guardar el centroid aquí

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    openingHours: [horarioSchema],

    featuredImage: String,
    profileImage: String,
    images: [String],

    tags: [String],
    isVerified: { type: Boolean, default: false },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isPremium: { type: Boolean, default: false },

    feedback: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

businessSchema.virtual("promotions", {
  ref: "Promotion",
  localField: "_id",
  foreignField: "business",
});

businessSchema.set("toObject", { virtuals: true });
businessSchema.set("toJSON", { virtuals: true });

businessSchema.index({ "location.coordinates": "2dsphere" });

export default mongoose.model("Business", businessSchema);
