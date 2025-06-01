import mongoose from "mongoose";

const horarioSchema = new mongoose.Schema({
  day: { type: String, required: true },
  open: { type: String, required: true },
  close: { type: String, required: true },
});

const socialMediaSchema = new mongoose.Schema({
  facebook: String,
  instagram: String,
  whatsapp: String,
});

const contactSchema = new mongoose.Schema({
  phone: String,
  email: {
    type: String,
    match: /.+\@.+\..+/,
  },
  website: String,
  socialMedia: socialMediaSchema,
});

const locationSchema = new mongoose.Schema({
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: String,
  country: { type: String, default: "USA" },
  coordinates: {
    lat: Number,
    lng: Number,
  },
});

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true,
    },

    contact: contactSchema,
    location: locationSchema,

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    openingHours: [horarioSchema],
    images: [{ type: String }],
    tags: [String],
    isVerified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Business", businessSchema);
