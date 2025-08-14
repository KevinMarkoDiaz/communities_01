// src/models/adBanner.model.js
import mongoose from "mongoose";

export const PLACEMENTS = [
  "home_top",
  "home_bottom",
  "sidebar_right_1",
  "sidebar_right_2",
  "listing_top",
  "listing_inline",
  "community_banner",
  "event_banner",
  "business_banner",
  "custom",
];
export const AD_STATUS = [
  "submitted", // enviado por el usuario
  "under_review", // admin lo está revisando
  "approved", // aprobado -> habilita pagar
  "awaiting_payment", // checkout creado, esperando pago
  "active", // pagado y publicado
  "rejected", // rechazado por admin
  "archived", // histórico
];
const AdBannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    placement: { type: String, enum: PLACEMENTS, required: true },

    // destino
    redirectUrl: { type: String, required: true, trim: true },
    imageAlt: { type: String, default: "" },

    // imagen base (compat) + variantes por dispositivo
    imageUrl: { type: String, default: "" }, // fallback / default
    imageDesktopUrl: { type: String, default: "" },
    imageTabletUrl: { type: String, default: "" },
    imageMobileUrl: { type: String, default: "" },

    // tracking / pesos / límites
    openInNewTab: { type: Boolean, default: true },
    weight: { type: Number, default: 1, min: 0 },

    maxImpressions: { type: Number, default: null },
    maxClicks: { type: Number, default: null },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

    // vigencia
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    isFallback: { type: Boolean, default: false },

    // segmentación (IDs en texto o ref; usa lo que ya tengas)
    communities: [{ type: mongoose.Schema.Types.ObjectId, ref: "Community" }],
    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    businesses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Business" }],

    // auditoría
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: String,
    createdByRole: String,
    currency: { type: String, default: "usd" }, // 'usd'
    priceCents: { type: Number, default: null }, // 5000, 3000, etc (centavos)
    status: {
      type: String,
      enum: AD_STATUS,
      default: "submitted",
      index: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedReason: String,
    publishedAt: Date,

    // --- Precio / Stripe ---
    priceCents: { type: Number, default: 0 }, // calculado por placement/días
    currency: { type: String, default: "usd" },
    stripeCheckoutSessionId: String,
    stripePaymentIntentId: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
AdBannerSchema.index({ placement: 1, status: 1, isActive: 1 });
// Virtual para devolver todas las variantes en una sola llave
AdBannerSchema.virtual("sources").get(function () {
  return {
    desktop: this.imageDesktopUrl || this.imageUrl || "",
    tablet: this.imageTabletUrl || this.imageUrl || "",
    mobile: this.imageMobileUrl || this.imageUrl || "",
    default:
      this.imageUrl ||
      this.imageDesktopUrl ||
      this.imageTabletUrl ||
      this.imageMobileUrl ||
      "",
  };
});

// Índices útiles
AdBannerSchema.index({ placement: 1, isActive: 1 });
AdBannerSchema.index({ isFallback: 1 });
AdBannerSchema.index({ startAt: 1, endAt: 1 });

const AdBanner = mongoose.model("AdBanner", AdBannerSchema);
export default AdBanner;
