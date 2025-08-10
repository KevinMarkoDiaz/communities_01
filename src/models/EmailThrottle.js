import mongoose from "mongoose";

const emailThrottleSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      index: true,
      required: true,
    },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailThrottleSchema.index({ recipient: 1, conversation: 1 }, { unique: true });

emailThrottleSchema.statics.canSend = async function (
  recipientId,
  conversationId,
  windowMinutes = 5
) {
  const now = new Date();
  const doc = await this.findOne({
    recipient: recipientId,
    conversation: conversationId,
  });
  if (!doc || !doc.lastSentAt) return true;

  const diffMs = now - doc.lastSentAt;
  const minMs = windowMinutes * 60 * 1000;
  return diffMs >= minMs;
};

emailThrottleSchema.statics.markSent = async function (
  recipientId,
  conversationId
) {
  const now = new Date();
  await this.findOneAndUpdate(
    { recipient: recipientId, conversation: conversationId },
    { $set: { lastSentAt: now } },
    { upsert: true, new: true }
  );
};

export default mongoose.model("EmailThrottle", emailThrottleSchema);
