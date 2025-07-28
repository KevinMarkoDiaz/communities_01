import mongoose from "mongoose";

// ⏰ Horario
const horarioSchema = new mongoose.Schema({
  day: { type: String, required: true },
  closed: { type: Boolean, default: false },
  open: {
    type: String,
    required: function () {
      return !this.closed;
    },
    validate: {
      validator: function (value) {
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
      validator: function (value) {
        if (this.closed) return true;
        return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
      },
      message: "Formato inválido para la hora de cierre (HH:mm)",
    },
  },
});

// 🌐 Redes sociales
const socialMediaSchema = new mongoose.Schema({
  facebook: String,
  instagram: String,
  whatsapp: String,
});

// 📞 Contacto
const contactSchema = new mongoose.Schema({
  phone: String,
  email: {
    type: String,
    match: /.+\@.+\..+/,
  },
  website: String,
  socialMedia: socialMediaSchema,
});

// 📍 Ubicación con coordenadas GeoJSON válidas
const locationSchema = new mongoose.Schema({
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, default: "" },
  country: { type: String, default: "USA" },
  coordinates: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
      validate: {
        validator: function (value) {
          return value.length === 2;
        },
        message: "Las coordenadas deben tener [lng, lat]",
      },
    },
  },
});
locationSchema.index({ coordinates: "2dsphere" }); // ✅ Índice geoespacial

// 🏪 Modelo principal de negocio
const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },

    contact: contactSchema,
    location: locationSchema,

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    openingHours: [horarioSchema],

    featuredImage: { type: String },
    profileImage: { type: String },
    images: [{ type: String }],

    tags: [String],
    isVerified: { type: Boolean, default: false },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    feedback: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// 🎯 Virtual de promociones relacionadas
businessSchema.virtual("promotions", {
  ref: "Promotion",
  localField: "_id",
  foreignField: "business",
});

businessSchema.set("toObject", { virtuals: true });
businessSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Business", businessSchema);
