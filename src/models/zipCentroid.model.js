// models/zipCentroid.model.js
import mongoose from "mongoose";

const zipCentroidSchema = new mongoose.Schema(
  {
    country: { type: String, default: "US", index: true },
    zip: { type: String, required: true, index: true }, // 5 dígitos
    centroid: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
  },
  { timestamps: true }
);

zipCentroidSchema.index({ country: 1, zip: 1 }, { unique: true });

export default mongoose.model("ZipCentroid", zipCentroidSchema);
