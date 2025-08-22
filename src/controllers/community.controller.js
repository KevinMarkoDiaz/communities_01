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
  // Usa el id que seteaste en app.js; si no, evita que salga "undefined"
  const reqId = req.id || "-";

  try {
    console.log(
      `[community:create] id=${reqId} start uid=${req.user?.id ?? "-"} role=${
        req.user?.role ?? "-"
      } origin=${req.headers.origin ?? "-"} ct=${
        req.headers["content-type"] ?? "-"
      } clen=${req.headers["content-length"] ?? "-"}`
    );

    if (!["admin", "business_owner"].includes(req.user.role)) {
      console.warn(
        `[community:create] id=${reqId} forbidden role=${req.user.role}`
      );
      return res
        .status(403)
        .json({ msg: "No tienes permisos para crear comunidades." });
    }

    // ─────────────────────────────────────────────────────────
    // Parseo del body (soporta FormData con campo "data")
    let data;
    try {
      if (typeof req.body?.data === "string") {
        data = JSON.parse(req.body.data);
        console.log(
          `[community:create] id=${reqId} parsed from "data" (multipart JSON)`
        );
      } else {
        data = req.body;
      }
    } catch (err) {
      console.warn(
        `[community:create] id=${reqId} parse-fail data-field: ${err.message}`
      );
      return res
        .status(400)
        .json({ msg: "Error al parsear los datos de entrada." });
    }

    // Resumen de claves y tipos para no loguear datos sensibles
    const keys = Object.keys(data || {});
    const types = Object.fromEntries(
      Object.entries(data || {}).map(([k, v]) => [
        k,
        Array.isArray(v) ? "array" : v === null ? "null" : typeof v,
      ])
    );
    console.log(
      `[community:create] id=${reqId} bodyKeys=${JSON.stringify(
        keys
      )} types=${JSON.stringify(types)}`
    );

    // ─────────────────────────────────────────────────────────
    // Validaciones mínimas (igual que tu lógica original)
    const { name } = data;
    if (!name) {
      console.warn(`[community:create] id=${reqId} missing name`);
      return res
        .status(400)
        .json({ msg: "El nombre de la comunidad es obligatorio." });
    }

    const existing = await Community.findOne({ name }).select("_id name slug");
    if (existing) {
      console.warn(
        `[community:create] id=${reqId} duplicate-name existing=${existing._id}`
      );
      return res
        .status(400)
        .json({ msg: "Ya existe una comunidad con ese nombre." });
    }

    // Slug (solo log, la lógica la mantengo igual)
    const slug = slugify(name, { lower: true, strict: true });
    console.log(`[community:create] id=${reqId} slug="${slug}"`);

    // Log de coordenadas (no cambia tu flujo, solo informa)
    const coords = data?.mapCenter?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) {
      console.warn(
        `[community:create] id=${reqId} mapCenter invalid coords=${JSON.stringify(
          coords
        )} (Mongoose podría fallar si es requerido)`
      );
    } else {
      // intenta castear a número para avisar si vienen como strings
      const [lng, lat] = [Number(coords[0]), Number(coords[1])];
      const nums = Number.isFinite(lng) && Number.isFinite(lat);
      const inRange =
        nums && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
      console.log(
        `[community:create] id=${reqId} coords parsed=[${lng},${lat}] numeric=${nums} inRange=${inRange}`
      );
    }

    // Normalización ligera de externalLinks (solo log)
    const extLen = Array.isArray(data.externalLinks)
      ? data.externalLinks.length
      : 0;
    console.log(`[community:create] id=${reqId} externalLinks.len=${extLen}`);

    // ─────────────────────────────────────────────────────────
    // Creación (misma lógica que tu código)
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

    console.log(
      `[community:create] id=${reqId} created _id=${newCommunity._id} owner=${req.user.id}`
    );

    return res.status(201).json({
      msg: "Comunidad creada exitosamente.",
      community: newCommunity,
    });
  } catch (error) {
    // Incluye info típica de Mongo (duplicate key, etc.)
    const code = error?.code ?? "-";
    const key = error?.keyPattern ? JSON.stringify(error.keyPattern) : "-";
    console.error(
      `[community:create] id=${reqId} err=${error.name} code=${code} key=${key} msg=${error.message}`
    );
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
      const radiusInMiles = 80;
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
      "externalLinks",
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
        link: `/comunidades/${community._id}`,
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
