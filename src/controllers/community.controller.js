import slugify from "slugify";
import mongoose from "mongoose";
import Community from "../models/community.model.js";
import communityViewModel from "../models/communityView.model.js";
import Follow from "../models/follow.model.js";
import Rating from "../models/rating.model.js";
import Comment from "../models/comment.model.js";
import Notification from "../models/Notification.model.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Crear comunidad
 */
export const createCommunity = async (req, res) => {
  try {
    if (!["admin", "business_owner"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para crear comunidades." });
    }

    let data;
    try {
      data = req.body.data ? JSON.parse(req.body.data) : req.body;
    } catch (err) {
      return res
        .status(400)
        .json({ msg: "Error al parsear los datos de entrada." });
    }

    const { name } = data;
    if (!name)
      return res
        .status(400)
        .json({ msg: "El nombre de la comunidad es obligatorio." });

    const existing = await Community.findOne({ name });
    if (existing) {
      return res
        .status(400)
        .json({ msg: "Ya existe una comunidad con ese nombre." });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const newCommunity = new Community({
      ...data,
      name,
      slug,
      owner: req.user.id,
      status: "Publicada",
      verified: false,
    });

    await newCommunity.save();

    res
      .status(201)
      .json({ msg: "Comunidad creada exitosamente.", community: newCommunity });
  } catch (error) {
    console.error("❌ Error en createCommunity:", error);
    res.status(500).json({ msg: "Error al crear la comunidad." });
  }
};

/**
 * Obtener todas las comunidades
 */
export const getAllCommunities = async (req, res) => {
  try {
    const communities = await Community.find().populate("owner", "name email");
    res.status(200).json({ communities });
  } catch (error) {
    console.error("❌ Error en getAllCommunities:", error);
    res.status(500).json({ msg: "Error al obtener comunidades." });
  }
};

/**
 * Obtener comunidad por ID
 */
export const getCommunityById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ msg: "ID de comunidad inválido." });
    }

    const community = await Community.findById(id)
      .populate("owner", "name email role profileImage")
      .populate("negocios", "name category location images")
      .populate("eventos", "title startDate endDate imagenDestacada");

    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    await communityViewModel.create({
      community: community._id,
      viewer: req.user ? req.user._id : null,
      isAnonymous: !req.user,
      viewedAt: new Date(),
    });

    res.status(200).json({ community });
  } catch (error) {
    console.error("❌ Error en getCommunityById:", error);
    res.status(500).json({ msg: "Error al obtener la comunidad." });
  }
};

/**
 * Obtener comunidad por slug público
 */
export const getCommunityBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const community = await Community.findOne({ slug })
      .populate("owner", "name email role profileImage")
      .populate("negocios", "name category location images")
      .populate("eventos", "title startDate endDate imagenDestacada");

    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    res.status(200).json({ community });
  } catch (error) {
    console.error("❌ Error en getCommunityBySlug:", error);
    res.status(500).json({ msg: "Error al buscar comunidad por slug." });
  }
};

/**
 * Actualizar comunidad
 */
export const updateCommunity = async (req, res) => {
  try {
    const data = req.body.data ? JSON.parse(req.body.data) : req.body;
    const { name } = data;

    let community = null;

    if (isValidObjectId(req.params.id)) {
      community = await Community.findById(req.params.id);
    } else {
      community = await Community.findOne({ slug: req.params.id });
    }

    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    const isOwner = community.owner.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para editar esta comunidad." });
    }

    if (name && name !== community.name) {
      const exists = await Community.findOne({ name });
      if (exists) {
        return res
          .status(400)
          .json({ msg: "Ya existe una comunidad con ese nombre." });
      }
      community.name = name;
      community.slug = slugify(name, { lower: true, strict: true });
    }

    const camposActualizables = [
      "description",
      "flagImage",
      "bannerImage",
      "language",
      "tipo",
      "populationEstimate",
      "originCountryInfo",
      "traditions",
      "food",
      "resources",
      "socialMediaLinks",
      "region",
      "mapCenter",
      "metaTitle",
      "metaDescription",
      "status",
      "verified",
    ];

    camposActualizables.forEach((campo) => {
      if (data[campo] !== undefined) {
        community[campo] = data[campo];
      }
    });

    await community.save();

    const followers = await Follow.find({
      entityType: "community",
      entityId: community._id,
    });

    if (followers.length > 0) {
      const notifications = followers.map((f) => ({
        user: f.user,
        actionType: "community_updated",
        entityType: "community",
        entityId: community._id,
        message: `La comunidad "${community.name}" ha actualizado su información.`,
        link: `/comunidades/${community.slug}`,
        read: false,
      }));

      await Notification.insertMany(notifications);
    }

    res
      .status(200)
      .json({ msg: "Comunidad actualizada exitosamente.", community });
  } catch (error) {
    console.error("❌ Error en updateCommunity:", error);
    res.status(500).json({ msg: "Error al actualizar la comunidad." });
  }
};

/**
 * Eliminar comunidad
 */
export const deleteCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ msg: "ID inválido." });
    }

    const community = await Community.findById(id);
    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    const isOwner = community.owner.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para eliminar esta comunidad." });
    }

    await community.deleteOne();
    res.status(200).json({ msg: "Comunidad eliminada exitosamente." });
  } catch (error) {
    console.error("❌ Error en deleteCommunity:", error);
    res.status(500).json({ msg: "Error al eliminar la comunidad." });
  }
};

/**
 * Obtener comunidades del usuario autenticado
 */
export const getMyCommunities = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { owner: req.user.id };
    const communities = await Community.find(filter);
    res.status(200).json({ communities });
  } catch (error) {
    console.error("❌ Error en getMyCommunities:", error);
    res.status(500).json({ msg: "Error al obtener comunidades." });
  }
};

/**
 * Resumen de comunidad
 */

export const getCommunitySummary = async (req, res) => {
  const { communityId } = req.params;

  if (!isValidObjectId(communityId)) {
    return res.status(400).json({ msg: "ID de comunidad inválido." });
  }

  try {
    const objectId = new mongoose.Types.ObjectId(communityId);

    const [followersCount, commentsCount, ratingsAggregation, allRatings] =
      await Promise.all([
        Follow.countDocuments({ entityType: "community", entity: objectId }),
        Comment.countDocuments({ entityType: "community", entity: objectId }),
        Rating.aggregate([
          { $match: { entityType: "community", entity: objectId } },
          { $group: { _id: "$value", count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ]),
        Rating.find(
          { entityType: "community", entity: objectId },
          { value: 1 }
        ),
      ]);

    const totalRatings = allRatings.length;
    const averageRating =
      totalRatings > 0
        ? (
            allRatings.reduce((acc, r) => acc + r.value, 0) / totalRatings
          ).toFixed(2)
        : null;

    res.status(200).json({
      followersCount,
      commentsCount,
      ratings: ratingsAggregation,
      averageRating,
    });
  } catch (error) {
    console.error("❌ Error en getCommunitySummary:", error);
    res
      .status(500)
      .json({ msg: "Error al obtener el resumen de la comunidad." });
  }
};
