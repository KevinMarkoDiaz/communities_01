// controllers/promotion.controller.js
import mongoose from "mongoose";
import Promotion from "../models/promotion.model.js";
import Business from "../models/business.model.js";
import Follow from "../models/follow.model.js";
import Notification from "../models/Notification.model.js";
import { promotionSchema } from "../schemas/promotionSchema.js";
import { zodErrorToResponse } from "../utils/zodErrorToResponse.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper para calcular "remaining"
const remainingOf = (p) =>
  p?.maxClaims == null
    ? null
    : Math.max(0, (p.maxClaims || 0) - (p.claimedCount || 0));

/**
 * GET /api/promotions
 * Lista de promociones con remaining calculado.
 */
export const getPromotions = async (req, res) => {
  try {
    const { community, category, type, business } = req.query;
    const filter = {};

    if (community) filter.community = community;
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (business) filter.business = business;

    const promos = await Promotion.find(filter)
      .populate("business", "name")
      .populate("community", "name")
      .populate("category", "name")
      .populate("createdBy", "name email")
      .lean();

    const promotions = promos.map((p) => ({
      ...p,
      remaining: remainingOf(p),
    }));

    res.status(200).json({ promotions });
  } catch (error) {
    console.error("Error en getPromotions:", error);
    res.status(500).json({ message: "Error al obtener promociones" });
  }
};

/**
 * POST /api/promotions
 * Crea una promoción. El claimedCount se inicia en 0 (en el modelo).
 */
export const createPromotion = async (req, res) => {
  try {
    const parsed = promotionSchema.safeParse(req.body);
    if (!parsed.success) return zodErrorToResponse(res, parsed.error);

    const {
      name,
      description,
      type,
      startDate,
      endDate,
      business,
      category,
      community,
      featuredImage,
      maxClaims,
    } = parsed.data;

    if (!isValidObjectId(business)) {
      return res.status(400).json({ message: "ID de negocio inválido" });
    }

    const negocio = await Business.findById(business);
    if (!negocio) {
      return res.status(404).json({ message: "Negocio no encontrado" });
    }

    // Solo el owner del negocio (o admin) puede crear
    if (
      req.user.role === "business_owner" &&
      negocio.owner.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "No autorizado para este negocio" });
    }

    // Límite de 5 promociones por negocio
    const count = await Promotion.countDocuments({ business });
    if (count >= 5) {
      return res.status(400).json({
        message: "Se ha alcanzado el límite de 5 promociones por negocio",
      });
    }

    const promotion = await Promotion.create({
      name,
      description,
      type,
      startDate,
      endDate,
      createdBy: req.user._id,
      business,
      category,
      community,
      featuredImage,
      maxClaims: typeof maxClaims === "number" ? maxClaims : null,
      isPremium: req.user.isPremium === true, // flag premium según el usuario
      // claimedCount: 0 // <- lo pone el modelo por defecto
    });

    // Notificar a seguidores del negocio
    const follows = await Follow.find({
      entityType: "business",
      entityId: negocio._id,
    });

    if (follows.length > 0) {
      const notifications = follows.map((f) => ({
        user: f.user,
        actionType: "new_promotion",
        entityType: "business",
        entityId: negocio._id,
        message: `El negocio ${negocio.name} publicó una nueva promoción: "${promotion.name}"`,
        link: `/negocios/${negocio._id}`,
        read: false,
      }));

      await Notification.insertMany(notifications);
    }

    res.status(201).json({
      message: "Promoción creada",
      promotion: { ...promotion.toObject(), remaining: remainingOf(promotion) },
    });
  } catch (error) {
    console.error("Error en createPromotion:", error);
    res.status(500).json({ message: "Error al crear promoción" });
  }
};

/**
 * PUT /api/promotions/:id
 * Actualiza promoción. Valida que maxClaims no sea menor que claimedCount actual.
 */
export const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID de promoción inválido" });
    }

    const parsed = promotionSchema.partial().safeParse(req.body);
    if (!parsed.success) return zodErrorToResponse(res, parsed.error);

    const promo = await Promotion.findById(id);
    if (!promo) {
      return res.status(404).json({ message: "Promoción no encontrada" });
    }

    // Solo admin o quien creó la promo (o dueño del negocio si así lo manejas)
    if (
      req.user.role === "business_owner" &&
      promo.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "No autorizado para editar esta promoción" });
    }

    // Si viene maxClaims en la actualización, validar contra claimedCount actual
    if (Object.prototype.hasOwnProperty.call(parsed.data, "maxClaims")) {
      const nuevoMax = parsed.data.maxClaims;
      if (nuevoMax !== null && typeof nuevoMax === "number") {
        if (nuevoMax < (promo.claimedCount || 0)) {
          return res.status(400).json({
            message: `maxClaims (${nuevoMax}) no puede ser menor a los ya reclamados (${
              promo.claimedCount || 0
            }).`,
          });
        }
      }
    }

    // Actualiza campos
    Object.assign(promo, parsed.data);

    // Si featuredImage viene en el body (aunque no pase zod por ser multipart), respétalo
    if (req.body.featuredImage) {
      promo.featuredImage = req.body.featuredImage;
    }

    // Recalcular estado premium por si cambió el usuario
    promo.isPremium = req.user.isPremium === true;

    await promo.save();

    // Notificar seguidores del negocio si existe business asociado
    if (promo.business) {
      const follows = await Follow.find({
        entityType: "business",
        entityId: promo.business,
      });

      if (follows.length > 0) {
        const notifications = follows.map((f) => ({
          user: f.user,
          actionType: "update",
          entityType: "business",
          entityId: promo.business,
          message: `El negocio ha actualizado una promoción: "${promo.name}"`,
          link: `/negocios/${promo.business}`,
          read: false,
        }));

        await Notification.insertMany(notifications);
      }
    }

    res.json({
      message: "Promoción actualizada",
      promotion: { ...promo.toObject(), remaining: remainingOf(promo) },
    });
  } catch (error) {
    console.error("Error en updatePromotion:", error);
    res.status(500).json({ message: "Error al actualizar promoción" });
  }
};

/**
 * DELETE /api/promotions/:id
 */
export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID de promoción inválido" });
    }

    const promo = await Promotion.findById(id);
    if (!promo) {
      return res.status(404).json({ message: "Promoción no encontrada" });
    }

    if (
      req.user.role === "business_owner" &&
      promo.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "No autorizado para eliminar esta promoción" });
    }

    await promo.deleteOne();
    res.json({ message: "Promoción eliminada" });
  } catch (error) {
    console.error("Error en deletePromotion:", error);
    res.status(500).json({ message: "Error al eliminar promoción" });
  }
};

/**
 * GET /api/promotions/community/:id
 * Lista las promos de una comunidad con remaining.
 */
export const getPromotionsByCommunity = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "ID de comunidad inválido" });
  }

  try {
    const promos = await Promotion.find({ community: id })
      .populate("business", "name profileImage")
      .populate("category", "name icon")
      .populate("createdBy", "name role")
      .lean();

    const promotions = promos.map((p) => ({
      ...p,
      remaining: remainingOf(p),
    }));

    res.status(200).json({
      success: true,
      count: promotions.length,
      promotions,
    });
  } catch (error) {
    console.error("Error al obtener promociones por comunidad:", error);
    res.status(500).json({ message: "Error al obtener promociones" });
  }
};

/**
 * GET /api/promotions/mine
 * Promos creadas por el usuario actual con remaining.
 */
export const getMyPromotions = async (req, res) => {
  try {
    const promos = await Promotion.find({ createdBy: req.user._id }).lean();
    const promotions = promos.map((p) => ({
      ...p,
      remaining: remainingOf(p),
    }));
    res.status(200).json({ promotions });
  } catch (error) {
    console.error("Error al obtener promociones del usuario:", error);
    res
      .status(500)
      .json({ message: "Error al obtener promociones del usuario" });
  }
};
