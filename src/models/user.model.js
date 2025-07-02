import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, lowercase: true, unique: true, sparse: true },
    password: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    role: {
      type: String,
      enum: ["user", "admin", "business_owner"],
      default: "user",
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    // Info del formulario de perfil
    title: { type: String, trim: true },
    description: { type: String, maxlength: 1000 },
    profileImage: { type: String, default: "" },
    location: { type: String },
    country: { type: String },

    // Relación con comunidad principal
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
    },

    // Relaciones dinámicas
    businesses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Business",
      },
    ],
    events: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    communities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
      },
    ],

    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Puedes añadir métodos de comparación de contraseñas si usas login local

export default mongoose.model("User", userSchema);
