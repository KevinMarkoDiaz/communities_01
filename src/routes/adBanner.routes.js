import { Router } from "express";
import { authMiddleware } from "../middlewares/validateToken.js";
import { hasRole } from "../middlewares/hasRole.js";
import { validateBody } from "../middlewares/validator.middleware.js";

import {
  createAdBanner,
  listAdBanners,
  getAdBannerById,
  updateAdBanner,
  deleteAdBanner,
  getActiveBanners,
  trackAdEvent,
} from "../controllers/adBanner.controller.js";

import {
  uploadAdImages,
  processAdImages,
} from "../middlewares/adUpload.middleware.js";
import nocache from "../middlewares/nocache.js";

const router = Router();

/**
 * Admin/BO: crear banner (multipart)
 * body: data (JSON string con los campos) + bannerImage (file)
 */
router.post(
  "/ads/banners",
  authMiddleware,
  hasRole("admin"),
  uploadAdImages,
  processAdImages,
  createAdBanner
);

// Listado y consulta
router.get("/ads/banners", authMiddleware, hasRole("admin"), listAdBanners);
router.get(
  "/ads/banners/:id",
  authMiddleware,
  hasRole("admin"),
  getAdBannerById
);

// Actualizar (imagen opcional)
router.put(
  "/ads/banners/:id",
  authMiddleware,
  hasRole("admin"),
  uploadAdImages,
  processAdImages,
  updateAdBanner
);

// Eliminar
router.delete(
  "/ads/banners/:id",
  authMiddleware,
  hasRole("admin"),
  deleteAdBanner
);

/**
 * Público: obtener banners activos por placement/segmentación
 * GET /ads/active?placement=home_top&communityId=...&limit=1&strategy=weighted
 */
router.get("/ads/active", nocache, getActiveBanners);

/**
 * Tracking (público): el front llama cuando renderiza o clickea
 * POST /ads/banners/:id/track?type=impression  |  click
 */
router.post("/ads/banners/:id/track", nocache, trackAdEvent);

export default router;
