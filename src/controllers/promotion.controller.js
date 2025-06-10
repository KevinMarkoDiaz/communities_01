// controllers/promotion.controller.js

import mongoose from "mongoose";

import Promotion from "../models/promotion.model.js";
import Business from "../models/business.model.js";

import { zodErrorToResponse } from "../utils/zodErrorToResponse.js";
import { promotionSchema } from "../schemas/promotionSchema.js";
import promotionModel from "../models/promotion.model.js";

/**
 * GET /api/promotions
 * Obtener promociones con filtros opcionales
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

    res.json({ promotions: promos });
  } catch (error) {
    console.error("🛑 Error en getPromotions:", error);
    res.status(500).json({ msg: "Error al obtener promociones" });
  }
};

/**
 * POST /api/promotions
 * Crear una nueva promoción
 */
export const createPromotion = async (req, res) => {
  try {
    console.log("🔹 BODY recibido:", req.body);
    console.log("🔹 Usuario autenticado:", req.user);

    const data = req.body;
    const parsed = promotionSchema.safeParse(data);
    if (!parsed.success) {
      console.log("❌ Error de validación Zod:", parsed.error.flatten());
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
      createdBy,
      featuredImage,
    } = req.body;

    const negocio = await Business.findById(business);
    if (!negocio) {
      return res.status(404).json({ msg: "Negocio no encontrado" });
    }

    if (
      req.user.role === "business_owner" &&
      negocio.owner.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ msg: "No autorizado para este negocio" });
    }

    const count = await Promotion.countDocuments({ business });
    if (count >= 5) {
      return res.status(400).json({ msg: "Máximo 5 promociones por negocio" });
    }

    const promotion = await Promotion.create({
      name,
      description,
      type,
      startDate,
      endDate,
      createdBy: new mongoose.Types.ObjectId(req.body.createdBy),
      business: new mongoose.Types.ObjectId(req.body.business),
      category: new mongoose.Types.ObjectId(req.body.category),
      community: new mongoose.Types.ObjectId(req.body.community),
      featuredImage,
    });

    res.status(201).json({ msg: "Promoción creada", promotion });
  } catch (error) {
    console.error("🛑 Error en createPromotion:", error);
    res.status(500).json({ msg: "Error al crear promoción" });
  }
};

/**
 * PUT /api/promotions/:id
 * Editar una promoción
 */
export const updatePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const parsed = promotionSchemaZ.partial().safeParse(data);
    if (!parsed.success) {
      return zodErrorToResponse(res, parsed.error);
    }

    const promo = await Promotion.findById(id);
    if (!promo) {
      return res.status(404).json({ msg: "Promoción no encontrada" });
    }

    if (
      req.user.role === "business_owner" &&
      promo.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ msg: "No autorizado para editar" });
    }

    Object.assign(promo, parsed.data);

    if (req.body.featuredImage) {
      promo.featuredImage = req.body.featuredImage;
    }

    await promo.save();

    console.log("🟢 Promoción actualizada:", promo._id);
    res.json({ msg: "Promoción actualizada", promotion: promo });
  } catch (error) {
    console.error("🛑 Error en updatePromotion:", error);
    res.status(500).json({ msg: "Error al actualizar promoción" });
  }
};

/**
 * DELETE /api/promotions/:id
 * Eliminar una promoción
 */
export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await Promotion.findById(id);
    if (!promo) {
      return res.status(404).json({ msg: "Promoción no encontrada" });
    }

    if (
      req.user.role === "business_owner" &&
      promo.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ msg: "No autorizado para eliminar" });
    }

    await promo.deleteOne();
    console.log("🗑️ Promoción eliminada:", id);
    res.json({ msg: "Promoción eliminada" });
  } catch (error) {
    console.error("🛑 Error en deletePromotion:", error);
    res.status(500).json({ msg: "Error al eliminar promoción" });
  }
};

export const getPromotionsByCommunity = async (req, res) => {
  const { id } = req.params;

  try {
    const promotions = await promotionModel
      .find({ community: id })
      .populate("business", "name profileImage")
      .populate("category", "name icon")
      .populate("createdBy", "name role");

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

// src/controllers/promotion.controller.js
export const getMyPromotions = async (req, res) => {
  try {
    const promociones = await Promotion.find({ createdBy: req.user.id });
    res.json({ promotions: promociones }); // ✅ debe devolver un objeto con clave `promotions`
  } catch (error) {
    console.error("Error al obtener promociones:", error);
    res.status(500).json({ msg: "Error al obtener promociones" });
  }
};
