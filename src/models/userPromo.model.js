// models/userPromo.model.js
import mongoose from "mongoose";

const userPromoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    promotion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Promotion",
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    redeemed: {
      type: Boolean,
      default: false,
    },
    redeemedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Evitar reclamos duplicados por el mismo usuario
userPromoSchema.index({ user: 1, promotion: 1 }, { unique: true });

export default mongoose.models.UserPromo ||
  mongoose.model("UserPromo", userPromoSchema);
