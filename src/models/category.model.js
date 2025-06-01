import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    icon: {
      type: String,
      default: "", // Podés usar una URL por defecto si querés
    },
    description: {
      type: String,
      maxlength: 500,
    },

    // Auditoría de creación
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
      trim: true,
    },
    createdByRole: {
      type: String,
      enum: ["admin", "business_owner", "user"],
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt y updatedAt
  }
);

export default mongoose.model("Category", categorySchema);
