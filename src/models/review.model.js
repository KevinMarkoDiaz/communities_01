import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  target: { type: mongoose.Schema.Types.ObjectId, refPath: "targetModel", required: true },
  targetModel: { type: String, enum: ["Business", "Event"], required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Review", reviewSchema);


