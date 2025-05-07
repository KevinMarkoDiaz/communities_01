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
    location: {
      type: String,
      required: true,
    },
    communities: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
    }],
    businesses: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
    }],
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    }],
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "organizerModel",
      required: true,
    },
    organizerModel: {
      type: String,
      enum: ["User", "Business"],
      required: true,
    },
    image: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true, // Crea createdAt y updatedAt automáticamente
  }
);

export default mongoose.model("Event", eventSchema);
