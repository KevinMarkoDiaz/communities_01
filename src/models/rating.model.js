import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    value: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetType: {
      type: String,
      enum: ["business", "event"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Rating", ratingSchema);
