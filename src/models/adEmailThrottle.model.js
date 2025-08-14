// src/models/adEmailThrottle.model.js
import mongoose from "mongoose";

const adEmailThrottleSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    adBanner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdBanner",
      index: true,
      required: true,
    },
    type: { type: String, required: true }, // "submitted" | "approved" | "published" | ...
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

adEmailThrottleSchema.index(
  { recipient: 1, adBanner: 1, type: 1 },
  { unique: true }
);

adEmailThrottleSchema.statics.canSend = async function (
  recipientId,
  bannerId,
  type,
  windowMinutes = 5
) {
  const now = new Date();
  const doc = await this.findOne({
    recipient: recipientId,
    adBanner: bannerId,
    type,
  });
  if (!doc || !doc.lastSentAt) return true;
  const diffMs = now - doc.lastSentAt;
  const minMs = windowMinutes * 60 * 1000;
  return diffMs >= minMs;
};

adEmailThrottleSchema.statics.markSent = async function (
  recipientId,
  bannerId,
  type
) {
  const now = new Date();
  await this.findOneAndUpdate(
    { recipient: recipientId, adBanner: bannerId, type },
    { $set: { lastSentAt: now } },
    { upsert: true, new: true }
  );
};

export default mongoose.model("AdEmailThrottle", adEmailThrottleSchema);
