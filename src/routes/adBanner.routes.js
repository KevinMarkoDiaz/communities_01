// src/routes/adBanner.routes.js
import { Router } from "express";
import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";
import nocache from "../middlewares/nocache.js";

import {
  createAdBanner,
  listAdBanners,
  getAdBannerById,
  updateAdBanner,
  deleteAdBanner,
  getActiveBanners,
  trackAdEvent,
  markUnderReview,
  approveAdBanner,
  rejectAdBanner,
  createAdCheckout,
  myAdBanners,
  listMyAdBanners,
  adminListAdBanners, // ⬅️ NUEVO
} from "../controllers/adBanner.controller.js";

import {
  uploadAdImages,
  processAdImages,
} from "../middlewares/adUpload.middleware.js";

const router = Router();

/** PUBLIC/FRONT */
router.get("/ads/active", nocache, getActiveBanners);
/** Tracking público (impresiones/clicks) */
router.post("/ads/banners/:id/track", nocache, trackAdEvent);

/** USER: listado de mis banners */
router.get("/ads/my-banners", authMiddleware, myAdBanners);

/** USER: enviar solicitud (multipart) */
router.post(
  "/ads/banners/submit",
  authMiddleware,
  uploadAdImages,
  processAdImages,
  createAdBanner
);

/** ADMIN: gestión */
router.get("/ads/banners", authMiddleware, hasRole("admin"), listAdBanners);
router.get(
  "/ads/banners/:id",
  authMiddleware,
  hasRole("admin"),
  getAdBannerById
);
router.put(
  "/ads/banners/:id",
  authMiddleware,
  hasRole("admin"),
  uploadAdImages,
  processAdImages,
  updateAdBanner
);
router.delete(
  "/ads/banners/:id",
  authMiddleware,
  hasRole("admin"),
  deleteAdBanner
);

/** ADMIN: flujo de revisión */
router.post(
  "/ads/banners/:id/under-review",
  authMiddleware,
  hasRole("admin"),
  markUnderReview
);
router.post(
  "/ads/banners/:id/approve",
  authMiddleware,
  hasRole("admin"),
  approveAdBanner
);
router.post(
  "/ads/banners/:id/reject",
  authMiddleware,
  hasRole("admin"),
  rejectAdBanner
);
router.get("/ads/my-banners", authMiddleware, listMyAdBanners);
router.get(
  "/admin/ads/banners",
  authMiddleware,
  hasRole("admin"),
  adminListAdBanners
);

/** OWNER o ADMIN: crear checkout para pagar */
// router.post("/ads/banners/:id/checkout", authMiddleware, createAdCheckout);

export default router;
