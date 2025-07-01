import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },

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
    title: { type: String, trim: true }, // Ej: "Chef venezolano", "Dueño de tienda"
    description: { type: String, maxlength: 1000 }, // Bio o resumen
    profileImage: { type: String, default: "" },
    location: { type: String },
    country: { type: String },

    // Relación con comunidad principal
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
    },

    // Relaciones dinámicas (para usar con populate)
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
    timestamps: true, // incluye createdAt y updatedAt automáticamente
  }
);

export default mongoose.model("User", userSchema);
