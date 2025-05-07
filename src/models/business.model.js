import mongoose from "mongoose";

// Definición del esquema para negocios   
const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    community: { type: mongoose.Schema.Types.ObjectId, ref: "Community", required: true },
    location: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String },
      country: { type: String, default: "USA" },
      coordinates: {
        lat: { type: Number, required: false }, // Opcional si no es obligatorio
        lng: { type: Number, required: false }, // Opcional si no es obligatorio
      },
    },
    contact: {
      phone: { type: String },
      email: { type: String, match: /.+\@.+\..+/ }, // Validación básica de correo electrónico
      website: { type: String },
      socialMedia: {
        facebook: { type: String },
        instagram: { type: String },
        whatsapp: { type: String },
      },
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    openingHours: [
      { day: { type: String }, open: { type: String }, close: { type: String } },
    ],
    images: [{ type: String }],
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Esto generará `createdAt` y `updatedAt` automáticamente
  }
);

export default mongoose.model("Business", businessSchema);
