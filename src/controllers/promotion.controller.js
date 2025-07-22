import mongoose from "mongoose";
import Promotion from "../models/promotion.model.js";
import Business from "../models/business.model.js";
import Follow from "../models/follow.model.js";
import Notification from "../models/Notification.model.js";
import { promotionSchema } from "../schemas/promotionSchema.js";

import { zodErrorToResponse } from "../utils/zodErrorToResponse.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * GET /api/promotions
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
      .populate("createdBy", "name email");

    res.status(200).json({ promotions: promos });
  } catch (error) {
    console.error("Error en getPromotions:", error);
    res.status(500).json({ message: "Error al obtener promociones" });
  }
};

/**
 * POST /api/promotions
 */
export const createPromotion = async (req, res) => {
  try {
    // ✅ Validar con Zod directamente desde req.body (ya parseado por middleware)
    const parsed = promotionSchema.safeParse(req.body);

    if (!parsed.success) {
      console.log("❌ Error Zod DETALLADO:");

      return zodErrorToResponse(res, parsed.error);
    }

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
    } = parsed.data;

    // 📌 Verificar ID de negocio válido
    if (!isValidObjectId(business)) {
      return res.status(400).json({ message: "ID de negocio inválido" });
    }

    const negocio = await Business.findById(business);
    if (!negocio) {
      return res.status(404).json({ message: "Negocio no encontrado" });
    }

    // 🔒 Verificación de propiedad si es business_owner
    if (
      req.user.role === "business_owner" &&
      negocio.owner.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "No autorizado para este negocio" });
    }

    // ⛔ Límite de promociones por negocio
    const count = await Promotion.countDocuments({ business });
    if (count >= 5) {
      return res.status(400).json({
        message: "Se ha alcanzado el límite de 5 promociones por negocio",
      });
    }

    // ✅ Crear la promoción
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
    });

    // 🔔 Notificar a seguidores del negocio
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

    // 🎉 Éxito
    res.status(201).json({ message: "Promoción creada", promotion });
  } catch (error) {
    console.error("Error en createPromotion:", error);
    res.status(500).json({ message: "Error al crear promoción" });
  }
};

/**
 * PUT /api/promotions/:id
 */
export const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "ID de promoción inválido" });
    }

    // ✅ Validar datos ya parseados con Zod
    const parsed = promotionSchema.partial().safeParse(req.body);

    if (!parsed.success) {
      console.log("❌ Error Zod:", parsed.error.flatten());
      return zodErrorToResponse(res, parsed.error);
    }

    const promo = await Promotion.findById(id);
    if (!promo) {
      return res.status(404).json({ message: "Promoción no encontrada" });
    }

    // 🔒 Verificación de permisos
    if (
      req.user.role === "business_owner" &&
      promo.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "No autorizado para editar esta promoción" });
    }

    // 🛠️ Actualizar campos permitidos
    Object.assign(promo, parsed.data);

    if (req.body.featuredImage) {
      promo.featuredImage = req.body.featuredImage;
    }

    await promo.save();

    // 🔔 Notificar a seguidores
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

    res.json({ message: "Promoción actualizada", promotion: promo });
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
 */
export const getPromotionsByCommunity = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ message: "ID de comunidad inválido" });
  }

  try {
    const promotions = await Promotion.find({ community: id })
      .populate("business", "name profileImage")
      .populate("category", "name icon")
      .populate("createdBy", "name role");

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
 */
export const getMyPromotions = async (req, res) => {
  try {
    const promociones = await Promotion.find({ createdBy: req.user._id });
    res.status(200).json({ promotions: promociones });
  } catch (error) {
    console.error("Error al obtener promociones del usuario:", error);
    res
      .status(500)
      .json({ message: "Error al obtener promociones del usuario" });
  }
};
