import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    entityType: {
      type: String,
      enum: ["business", "event", "community", "promotion", "message"],
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityType",
    },

    actionType: {
      type: String,
      required: true,
      // 🚀 Ejemplos de valores:
      // "promotion_created", "promotion_updated",
      // "event_created", "event_updated",
      // "business_updated", "community_published", etc.
    },

    message: {
      type: String,
      required: true,
    },

    link: {
      type: String,
      required: true,
    },

    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
