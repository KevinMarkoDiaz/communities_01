import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String,
      required: true, // ⏰ agregado según el mock (hora del evento)
    },
    location: {
      type: String,
      required: true,
    },
    featuredImage: {
      type: String,
      default: "",
    },
    tags: [String],

    // Relacionado con comunidades
    communities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
      },
    ],

    // Relacionado con negocios asociados al evento
    businesses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Business",
      },
    ],

    // Relacionado con categorías del evento
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // Organizador dinámico (puede ser User o Business)
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
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt
  }
);

export default mongoose.model("Event", eventSchema);
