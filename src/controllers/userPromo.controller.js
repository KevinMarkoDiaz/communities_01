// controllers/userPromo.controller.js
import { v4 as uuidv4 } from "uuid";
import UserPromo from "../models/userPromo.model.js";
import Promotion from "../models/promotion.model.js";
import Business from "../models/business.model.js";

export const claimPromotion = async (req, res) => {
  const { promotionId } = req.params;
  const userId = req.user._id;

  try {
    const alreadyClaimed = await UserPromo.findOne({
      user: userId,
      promotion: promotionId,
    });

    if (alreadyClaimed) {
      return res.status(409).json({
        message: "Ya guardaste esta promoción.",
        userPromo: alreadyClaimed,
      });
    }

    const promo = await Promotion.findById(promotionId);
    if (!promo) {
      return res.status(404).json({ message: "Promoción no encontrada." });
    }

    // ✅ Contar cuántas veces ya fue reclamada
    const currentClaims = await UserPromo.countDocuments({
      promotion: promotionId,
    });

    // ⚠️ Validar si se alcanzó el máximo
    if (promo.maxClaims && currentClaims >= promo.maxClaims) {
      return res.status(400).json({
        message:
          "Se alcanzó el límite de cupones disponibles para esta promoción.",
        remainingClaims: 0,
      });
    }

    const code = uuidv4().split("-")[0].toUpperCase();

    const newUserPromo = await UserPromo.create({
      user: userId,
      promotion: promotionId,
      code,
    });

    const remainingClaims = promo.maxClaims
      ? promo.maxClaims - (currentClaims + 1)
      : null;

    res.status(201).json({
      message: "Promoción guardada",
      userPromo: newUserPromo,
      remainingClaims,
    });
  } catch (error) {
    console.error("Error en claimPromotion:", error);
    res.status(500).json({ message: "Error al guardar la promoción" });
  }
};

export const redeemPromotionCode = async (req, res) => {
  const { code } = req.body;
  const businessOwnerId = req.user._id;

  try {
    const userPromo = await UserPromo.findOne({ code }).populate("promotion");

    if (!userPromo) {
      return res.status(404).json({ message: "Código no válido" });
    }

    if (userPromo.redeemed) {
      return res.status(400).json({ message: "Este código ya fue redimido" });
    }

    const business = await Business.findById(userPromo.promotion.business);
    if (!business || business.owner.toString() !== businessOwnerId.toString()) {
      return res
        .status(403)
        .json({ message: "No autorizado para redimir esta promoción" });
    }

    userPromo.redeemed = true;
    userPromo.redeemedAt = new Date();
    await userPromo.save();

    res.status(200).json({ message: "Código redimido con éxito", userPromo });
  } catch (error) {
    console.error("Error en redeemPromotionCode:", error);
    res.status(500).json({ message: "Error al redimir el código" });
  }
};

export const getMyClaimedPromos = async (req, res) => {
  try {
    const userPromos = await UserPromo.find({ user: req.user._id })
      .populate({
        path: "promotion",
        populate: [
          { path: "business", select: "name profileImage" },
          { path: "category", select: "name" },
          { path: "community", select: "name" },
        ],
      })
      .sort({ createdAt: -1 });

    res.status(200).json(userPromos);
  } catch (error) {
    console.error("Error en getMyClaimedPromos:", error);
    res.status(500).json({ message: "Error al obtener promociones guardadas" });
  }
};
