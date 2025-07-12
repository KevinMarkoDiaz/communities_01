// controllers/promotion.controller.js

import mongoose from "mongoose";
import Promotion from "../models/promotion.model.js";
import Business from "../models/business.model.js";
import Follow from "../models/follow.model.js";
import Notification from "../models/Notification.model.js";

import { zodErrorToResponse } from "../utils/zodErrorToResponse.js";
import { promotionSchema } from "../schemas/promotionSchema.js";
import promotionModel from "../models/promotion.model.js";

/**
 * GET /api/promotions
 */
export const getPromotions = async (req, res) => {
  try {
    console.log("🔍 getPromotions query params:", req.query);

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

    console.log("✅ getPromotions found:", promos.length);
    res.json({ promotions: promos });
  } catch (error) {
    console.error("🛑 Error en getPromotions:", error);
    res.status(500).json({ msg: "Error al obtener promociones" });
  }
};

/**
 * POST /api/promotions
 */
export const createPromotion = async (req, res) => {
  try {
    console.log("📥 createPromotion req.body:", req.body);

    const data = req.body;
    const parsed = promotionSchema.safeParse(data);
    if (!parsed.success) {
      console.log("⚠️ Zod validation failed:", parsed.error);
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
    } = req.body;

    console.log("🔍 Buscando negocio:", business);
    const negocio = await Business.findById(business);
    if (!negocio) {
      console.log("❌ Negocio no encontrado");
      return res.status(404).json({ msg: "Negocio no encontrado" });
    }

    if (
      req.user.role === "business_owner" &&
      negocio.owner.toString() !== req.user._id.toString()
    ) {
      console.log("⛔ No autorizado para este negocio");
      return res.status(403).json({ msg: "No autorizado para este negocio" });
    }

    const count = await Promotion.countDocuments({ business });
    console.log("🔢 Promociones actuales de este negocio:", count);
    if (count >= 5) {
      return res.status(400).json({ msg: "Máximo 5 promociones por negocio" });
    }

    const promotion = await Promotion.create({
      name,
      description,
      type,
      startDate,
      endDate,
      createdBy: new mongoose.Types.ObjectId(req.user._id),
      business: new mongoose.Types.ObjectId(business),
      category: new mongoose.Types.ObjectId(category),
      community: new mongoose.Types.ObjectId(community),
      featuredImage,
    });

    console.log("✅ Promoción creada:", promotion._id);

    // 🎯 Crear notificaciones a los seguidores del negocio
    const follows = await Follow.find({
      entityType: "business",
      entityId: negocio._id,
    });

    console.log(`📬 Encontrados ${follows.length} seguidores del negocio`);

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
      console.log(`✅ ${notifications.length} notificaciones creadas`);
    }

    res.status(201).json({ msg: "Promoción creada", promotion });
  } catch (error) {
    console.error("🛑 Error en createPromotion:", error);
    res.status(500).json({ msg: "Error al crear promoción" });
  }
};

/**
 * PUT /api/promotions/:id
 */
export const updatePromotion = async (req, res) => {
  try {
    console.log("✏️ updatePromotion body:", req.body);

    const { id } = req.params;
    const data = req.body;

    const parsed = promotionSchema.partial().safeParse(data);
    if (!parsed.success) {
      console.log("⚠️ Zod validation failed:", parsed.error);
      return zodErrorToResponse(res, parsed.error);
    }

    const promo = await Promotion.findById(id);
    if (!promo) {
      console.log("❌ Promoción no encontrada:", id);
      return res.status(404).json({ msg: "Promoción no encontrada" });
    }

    if (
      req.user.role === "business_owner" &&
      promo.createdBy.toString() !== req.user._id.toString()
    ) {
      console.log("⛔ No autorizado para editar");
      return res.status(403).json({ msg: "No autorizado para editar" });
    }

    Object.assign(promo, parsed.data);
    if (req.body.featuredImage) {
      promo.featuredImage = req.body.featuredImage;
    }

    await promo.save();
    console.log("✅ Promoción actualizada:", promo._id);

    // 🎯 Crear notificaciones a los seguidores del negocio
    if (promo.business) {
      console.log("🔍 Buscando seguidores del negocio:", promo.business);
      const follows = await Follow.find({
        entityType: "business",
        entityId: promo.business,
      });

      console.log(`📬 Encontrados ${follows.length} seguidores del negocio`);

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
        console.log(`✅ ${notifications.length} notificaciones creadas`);
      }
    }

    res.json({ msg: "Promoción actualizada", promotion: promo });
  } catch (error) {
    console.error("🛑 Error en updatePromotion:", error);
    res.status(500).json({ msg: "Error al actualizar promoción" });
  }
};

/**
 * DELETE /api/promotions/:id
 */
export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🗑️ Eliminando promoción:", id);

    const promo = await Promotion.findById(id);
    if (!promo) {
      console.log("❌ Promoción no encontrada:", id);
      return res.status(404).json({ msg: "Promoción no encontrada" });
    }

    if (
      req.user.role === "business_owner" &&
      promo.createdBy.toString() !== req.user._id.toString()
    ) {
      console.log("⛔ No autorizado para eliminar");
      return res.status(403).json({ msg: "No autorizado para eliminar" });
    }

    await promo.deleteOne();
    console.log("✅ Promoción eliminada:", id);
    res.json({ msg: "Promoción eliminada" });
  } catch (error) {
    console.error("🛑 Error en deletePromotion:", error);
    res.status(500).json({ msg: "Error al eliminar promoción" });
  }
};

/**
 * GET /api/promotions/community/:id
 */
export const getPromotionsByCommunity = async (req, res) => {
  const { id } = req.params;
  console.log("🔍 Buscando promociones por comunidad:", id);

  try {
    const promotions = await promotionModel
      .find({ community: id })
      .populate("business", "name profileImage")
      .populate("category", "name icon")
      .populate("createdBy", "name role");

    console.log("✅ Promociones encontradas:", promotions.length);
    res.status(200).json({
      success: true,
      count: promotions.length,
      promotions,
    });
  } catch (error) {
    console.error("❌ Error al obtener promociones por comunidad:", error);
    res.status(500).json({ msg: "Error al obtener promociones" });
  }
};

/**
 * GET /api/promotions/mine
 */
export const getMyPromotions = async (req, res) => {
  try {
    console.log("👤 Obteniendo promociones del usuario:", req.user._id);
    const promociones = await Promotion.find({ createdBy: req.user._id });
    console.log("✅ Promociones del usuario:", promociones.length);
    res.json({ promotions: promociones });
  } catch (error) {
    console.error("🛑 Error al obtener promociones:", error);
    res.status(500).json({ msg: "Error al obtener promociones" });
  }
};
