import mongoose from "mongoose";
import UserPromo from "./userPromo.model.js";

const promotionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, maxlength: 2000 },
    type: {
      type: String,
      enum: [
        "promo_fin_de_semana",
        "descuentos_imperdibles",
        "nuevos_lanzamientos",
      ],
      required: true,
    },
    isPremium: {
      type: Boolean,
      default: false,
    },
    featuredImage: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    business: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    maxClaims: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

// Eliminar cupones asociados al borrar promoción
promotionSchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    try {
      await UserPromo.deleteMany({ promotion: this._id });
      next();
    } catch (error) {
      console.error("Error al eliminar cupones relacionados:", error);
      next(error);
    }
  }
);

export default mongoose.models.Promotion ||
  mongoose.model("Promotion", promotionSchema);
