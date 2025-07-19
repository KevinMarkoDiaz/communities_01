import mongoose from "mongoose";

const eventViewSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
    ip: {
      type: String,
      default: "",
    },
    referrer: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("EventView", eventViewSchema);
