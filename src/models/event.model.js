import mongoose from "mongoose";

// Subesquema de ubicación
const locationSchema = new mongoose.Schema({
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, default: "" },
  country: { type: String, default: "USA" },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
});

// Esquema principal
const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },

  location: { type: locationSchema, required: false },

  featuredImage: { type: String, default: "/placeholder-evento.jpg" },
  images: [String],
  tags: [String],
  language: { type: String, default: "es" },
  price: { type: Number, default: 0 },
  isFree: { type: Boolean, default: true },
  registrationLink: {
    type: String,
    set: (val) => (val === "" ? undefined : val),
  },
  isOnline: { type: Boolean, default: false },
  virtualLink: {
    type: String,
    set: (val) => (val === "" ? undefined : val),
  },

  communities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Community" }],
  businesses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Business" }],
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "organizerModel",
  },
  organizerModel: {
    type: String,
    required: true,
    enum: ["User", "Business"],
  },
  sponsors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Business" }],

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: function () {
      return this.isNew;
    },
  },
  createdAt: { type: Date, default: Date.now },
  isPublished: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ["activo", "finalizado", "cancelado"],
    default: "activo",
  },

  coordinates: {
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

  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  feedback: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

// ✅ Índice geoespacial
eventSchema.index({ coordinates: "2dsphere" });

export default mongoose.model("Event", eventSchema);
