import slugify from "slugify";
import mongoose from "mongoose";
import Community from "../models/community.model.js";
import communityViewModel from "../models/communityView.model.js";
import Follow from "../models/follow.model.js";
import Rating from "../models/rating.model.js";
import Comment from "../models/comment.model.js";
import Notification from "../models/Notification.model.js";
import { generateUniqueSlug } from "../utils/uniqueSlug.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Crear comunidad
 */
export const createCommunity = async (req, res) => {
  const reqId = req.id || "-";
  try {
    if (!["admin", "business_owner"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para crear comunidades." });
    }

    // ✅ Usa el body ya parseado + enriquecido por processCommunityImages (+ validateBody)
    const data = req.body;
    // (Por si acaso alguien mandó "data" aún presente)
    if (typeof data?.data === "string") delete data.data;

    // Validación mínima adicional
    const { name } = data;
    if (!name) {
      return res
        .status(400)
        .json({ msg: "El nombre de la comunidad es obligatorio." });
    }

    const existing = await Community.findOne({ name }).select("_id name slug");
    if (existing) {
      return res
        .status(400)
        .json({ msg: "Ya existe una comunidad con ese nombre." });
    }

    const slug = slugify(name, { lower: true, strict: true });

    // Crear y guardar
    const newCommunity = new Community({
      ...data,
      name,
      slug,
      owner: req.user.id,
      status: "Publicada",
      verified: false,
      externalLinks: Array.isArray(data.externalLinks)
        ? data.externalLinks
        : [],
    });

    await newCommunity.save();

    return res.status(201).json({
      msg: "Comunidad creada exitosamente.",
      community: newCommunity,
    });
  } catch (error) {
    const code = error?.code ?? "-";
    const key = error?.keyPattern ? JSON.stringify(error.keyPattern) : "-";

    return res.status(500).json({ msg: "Error al crear la comunidad." });
  }
};

/**
 * Obtener todas las comunidades
 */
export const getAllCommunities = async (req, res) => {
  try {
    const { lat, lng, page = 1, limit = 15 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    let query = {};
    let totalCount;

    if (lat && lng) {
      const radiusInMiles = 500;
      const radiusInRadians = radiusInMiles / 3963.2;

      query = {
        mapCenter: {
          $geoWithin: {
            $centerSphere: [
              [parseFloat(lng), parseFloat(lat)],
              radiusInRadians,
            ],
          },
        },
      };
    }

    totalCount = await Community.countDocuments(query);

    const communities = await Community.find(query)
      .skip(skip)
      .limit(parsedLimit)
      .populate("owner", "name email");

    res.status(200).json({
      communities,
      totalPages: Math.ceil(totalCount / parsedLimit),
      totalResults: totalCount,
      currentPage: parseInt(page),
    });
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
    // Body puede venir ya parseado por middlewares; si viene como string en "data", parseamos
    const dataRaw = req.body?.data ? req.body.data : req.body;
    const data = typeof dataRaw === "string" ? JSON.parse(dataRaw) : dataRaw;

    // No permitimos que el cliente setee slug manualmente
    if ("slug" in data) delete data.slug;

    // Soporta rutas con :id o :idOrSlug
    const idOrSlug = req.params.idOrSlug ?? req.params.id;

    // Busca por ObjectId o por slug
    let community = null;
    if (idOrSlug && isValidObjectId(idOrSlug)) {
      community = await Community.findById(idOrSlug);
    }
    if (!community) {
      community = await Community.findOne({ slug: idOrSlug });
    }

    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    // Autorización: owner o admin
    const isOwner = community.owner?.toString?.() === req.user?.id;
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para editar esta comunidad." });
    }

    // Si cambia el nombre: valida duplicado y regenera slug único
    if (data.name && data.name !== community.name) {
      const exists = await Community.findOne({
        name: data.name,
        _id: { $ne: community._id },
      }).select("_id");
      if (exists) {
        return res
          .status(400)
          .json({ msg: "Ya existe una comunidad con ese nombre." });
      }
      community.name = data.name;
      community.slug = await generateUniqueSlug(data.name, community._id);
    }

    // Campos permitidos a actualizar
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
      "externalLinks",
      "region",
      "mapCenter", // { type: "Point", coordinates: [lng, lat] }
      "metaTitle",
      "metaDescription",
      "status",
      "verified",
      "moderators",
      "featuredBusinesses",
      "featuredEvents",
      "mostPopularCategory",
      "memberCount",
      "businessCount",
      "eventCount",
    ];

    for (const campo of camposActualizables) {
      if (data[campo] !== undefined) {
        community[campo] = data[campo];
      }
    }

    await community.save();

    // Notificaciones a seguidores (link por slug)
    const followers = await Follow.find({
      entityType: "community",
      entityId: community._id,
    }).select("user");

    if (followers.length > 0) {
      const notifications = followers.map((f) => ({
        user: f.user,
        actionType: "community_updated",
        entityType: "community",
        entityId: community._id,
        message: `La comunidad "${community.name}" ha actualizado su información.`,
        link: `/comunidades/${community.slug}`, // ← SEO-friendly
        read: false,
      }));
      await Notification.insertMany(notifications);
    }

    // (Opcional) repoblar relaciones para devolver datos completos
    const populated = await Community.findById(community._id)
      .populate("owner", "name email role profileImage")
      .populate("negocios", "name category location images")
      .populate("eventos", "title startDate endDate imagenDestacada");

    return res.status(200).json({
      msg: "Comunidad actualizada exitosamente.",
      community: populated ?? community,
    });
  } catch (error) {
    console.error("❌ Error en updateCommunity:", error);
    return res.status(500).json({ msg: "Error al actualizar la comunidad." });
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

/**
 * Obtener comunidad por id o slug (genérico)
 * Acepta rutas tipo: /communities/:idOrSlug
 */
export const getCommunity = async (req, res) => {
  try {
    const idOrSlug = req.params.idOrSlug ?? req.params.id ?? req.params.slug;

    let community = null;
    if (idOrSlug && isValidObjectId(idOrSlug)) {
      community = await Community.findById(idOrSlug)
        .populate("owner", "name email role profileImage")
        .populate("negocios", "name category location images")
        .populate("eventos", "title startDate endDate imagenDestacada");
    }
    if (!community) {
      community = await Community.findOne({ slug: idOrSlug })
        .populate("owner", "name email role profileImage")
        .populate("negocios", "name category location images")
        .populate("eventos", "title startDate endDate imagenDestacada");
    }

    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    // registra vista (mismo patrón que getCommunityById)
    try {
      await communityViewModel.create({
        community: community._id,
        viewer: req.user ? req.user._id : null,
        isAnonymous: !req.user,
        viewedAt: new Date(),
      });
    } catch (e) {
      // no rompas la respuesta por un fallo de métricas
      console.warn("communityViewModel error:", e?.message || e);
    }

    return res.status(200).json({ community });
  } catch (error) {
    console.error("❌ Error en getCommunity:", error);
    return res.status(500).json({ msg: "Error al obtener la comunidad." });
  }
};
