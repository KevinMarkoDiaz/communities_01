// models/Follow.js
import mongoose from "mongoose";

const followSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    entityType: {
      type: String,
      enum: ["business", "event", "community"],
      required: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

followSchema.index({ user: 1, entityType: 1, entityId: 1 }, { unique: true });

export default mongoose.model("Follow", followSchema);
