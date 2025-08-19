// src/controllers/userPromo.controller.js
import mongoose from "mongoose";
import Promotion from "../models/promotion.model.js";
import UserPromo from "../models/userPromo.model.js";
import Business from "../models/business.model.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Genera un código corto y único-ish; si colisiona, reintenta
const genCode = () =>
  `PR-${Date.now().toString(36).slice(-4)}-${Math.random()
    .toString(36)
    .toUpperCase()
    .slice(2, 6)}`;

// 👤 POST /api/user-promos/:promotionId
export const claimPromotion = async (req, res) => {
  try {
    const { promotionId } = req.params;
    const userId = req.user._id;

    if (!isValidObjectId(promotionId)) {
      return res.status(400).json({ message: "ID de promoción inválido" });
    }

    // 1) Cargamos la promo para validar estado/fechas
    const promoDoc = await Promotion.findById(promotionId).select(
      "startDate endDate maxClaims claimedCount business name"
    );
    if (!promoDoc) {
      return res.status(404).json({ message: "Promoción no encontrada" });
    }

    const now = new Date();
    if (promoDoc.startDate && now < promoDoc.startDate) {
      return res
        .status(400)
        .json({ message: "La promoción aún no ha comenzado" });
    }
    if (promoDoc.endDate && now > promoDoc.endDate) {
      return res.status(410).json({ message: "La promoción ha finalizado" });
    }

    // 2) Reserva de cupo atómica (si maxClaims es null -> ilimitado).
    //    Usamos $expr para comparar claimedCount < maxClaims en el query.
    const reserved = await Promotion.findOneAndUpdate(
      {
        _id: promoDoc._id,
        $or: [
          { maxClaims: null },
          { $expr: { $lt: ["$claimedCount", "$maxClaims"] } },
        ],
      },
      { $inc: { claimedCount: 1 } },
      { new: true } // ← devuelve doc actualizado
    ).select("maxClaims claimedCount");

    if (!reserved) {
      return res.status(409).json({ message: "No quedan cupones disponibles" });
    }

    // 3) Creamos el UserPromo; si el usuario ya tenía uno, revertimos el cupo.
    let code;
    let created;
    let tries = 0;

    while (!created && tries < 5) {
      try {
        code = genCode();
        created = await UserPromo.create({
          user: userId,
          promotion: promoDoc._id,
          code,
        });
      } catch (err) {
        // Duplicado por índice único (user+promotion) => ya reclamó
        if (
          err?.code === 11000 &&
          err?.keyPattern?.user &&
          err?.keyPattern?.promotion
        ) {
          // rollback del cupo
          await Promotion.updateOne(
            { _id: promoDoc._id },
            { $inc: { claimedCount: -1 } }
          );
          return res
            .status(409)
            .json({ message: "Ya reclamaste esta promoción previamente" });
        }
        // Duplicado de code => reintenta generar otro
        if (err?.code === 11000 && err?.keyPattern?.code) {
          tries += 1;
          continue;
        }
        // Otro error
        // rollback del cupo por seguridad
        await Promotion.updateOne(
          { _id: promoDoc._id },
          { $inc: { claimedCount: -1 } }
        );
        throw err;
      }
    }

    if (!created) {
      // No logramos generar un code único tras varios intentos
      await Promotion.updateOne(
        { _id: promoDoc._id },
        { $inc: { claimedCount: -1 } }
      );
      return res
        .status(500)
        .json({ message: "No fue posible generar el cupón, reintenta" });
    }

    // 4) Respuesta con remaining
    const max = reserved.maxClaims;
    const count = reserved.claimedCount;
    const remaining = max == null ? null : Math.max(0, max - count);

    return res.status(201).json({
      message: "Cupón reclamado",
      userPromo: {
        id: created._id,
        code: created.code,
        redeemed: created.redeemed,
        redeemedAt: created.redeemedAt,
        promotion: String(promoDoc._id),
      },
      claimedCount: count,
      maxClaims: max,
      remaining,
    });
  } catch (error) {
    console.error("❌ Error en claimPromotion:", error);
    return res.status(500).json({ message: "Error al reclamar promoción" });
  }
};

// 🏪 POST /api/user-promos/redeem { code }
// Solo admin o business_owner (ya controlado en router con hasRole),
// y si es business_owner debe ser dueño del negocio de esa promo.
export const redeemPromotionCode = async (req, res) => {
  try {
    const raw = (req.body?.code || "").toString().trim();
    if (!raw) return res.status(400).json({ message: "Código requerido" });

    const code = raw.toUpperCase();

    const userPromo = await UserPromo.findOne({ code })
      .populate("promotion", "business name")
      .lean();

    if (!userPromo) {
      return res.status(404).json({ message: "Cupón no encontrado" });
    }

    // Si es business_owner: validar que sea dueño del negocio de la promo
    if (req.user.role === "business_owner") {
      const promoBusinessId = userPromo.promotion?.business;
      const biz = await Business.findById(promoBusinessId).select("owner");
      if (!biz || biz.owner.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "No autorizado para redimir este cupón" });
      }
    }

    if (userPromo.redeemed) {
      return res.status(200).json({
        message: "Cupón ya estaba redimido",
        redeemed: true,
        redeemedAt: userPromo.redeemedAt,
      });
    }

    const updated = await UserPromo.findOneAndUpdate(
      { code },
      { $set: { redeemed: true, redeemedAt: new Date() } },
      { new: true }
    ).lean();

    return res.status(200).json({
      message: "Cupón redimido correctamente",
      redeemed: true,
      redeemedAt: updated.redeemedAt,
    });
  } catch (error) {
    console.error("❌ Error en redeemPromotionCode:", error);
    return res.status(500).json({ message: "Error al redimir cupón" });
  }
};

// 👤 GET /api/user-promos
export const getMyClaimedPromos = async (req, res) => {
  try {
    const list = await UserPromo.find({ user: req.user._id })
      .populate(
        "promotion",
        "name featuredImage business community category maxClaims claimedCount endDate"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({ promos: list });
  } catch (error) {
    console.error("❌ Error en getMyClaimedPromos:", error);
    return res
      .status(500)
      .json({ message: "Error al obtener tus promociones reclamadas" });
  }
};
