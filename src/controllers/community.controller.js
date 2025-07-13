import slugify from "slugify";
import mongoose from "mongoose";
import Community from "../models/community.model.js";
import communityViewModel from "../models/communityView.model.js";
import Follow from "../models/follow.model.js";
import Rating from "../models/rating.model.js";
import Comment from "../models/comment.model.js";
/**
 * Crea una nueva comunidad.
 */
export const createCommunity = async (req, res) => {
  try {
    if (!["admin", "business_owner"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para crear comunidades." });
    }

    const data = req.body.data ? JSON.parse(req.body.data) : req.body;

    const {
      name,
      description,
      flagImage,
      bannerImage,
      language,
      tipo,
      populationEstimate,
      originCountryInfo,
      traditions,
      food,
      resources,
      socialMediaLinks,
      region,
      mapCenter,
      metaTitle,
      metaDescription,
    } = data;

    const existingCommunity = await Community.findOne({ name });
    if (existingCommunity) {
      return res
        .status(400)
        .json({ msg: "Ya existe una comunidad con ese nombre." });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const newCommunity = new Community({
      name,
      slug,
      description,
      flagImage,
      bannerImage,
      language,
      tipo,
      owner: req.user.id,
      populationEstimate,
      originCountryInfo,
      traditions,
      food,
      resources,
      socialMediaLinks,
      region,
      mapCenter,
      metaTitle,
      metaDescription,
      status: "Publicada",
      verified: false,
    });

    await newCommunity.save();

    res.status(201).json({
      msg: "Comunidad creada exitosamente.",
      community: newCommunity,
    });
  } catch (error) {
    console.error("❌ Error al crear comunidad:", error);
    res.status(500).json({ msg: "Error al crear la comunidad." });
  }
};

/**
 * Obtiene todas las comunidades.
 */
export const getAllCommunities = async (req, res) => {
  try {
    const communities = await Community.find().populate("owner", "name email");
    res.status(200).json({ communities });
  } catch (error) {
    console.error("❌ Error al obtener comunidades:", error);
    res.status(500).json({ msg: "Error al obtener comunidades." });
  }
};

/**
 * Obtiene una comunidad por ID.
 */
export const getCommunityById = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id)
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
    console.error("❌ Error al obtener comunidad:", error);
    res.status(500).json({ msg: "Error al obtener la comunidad." });
  }
};

/**
 * Actualiza una comunidad.
 */
export const updateCommunity = async (req, res) => {
  try {
    const data = req.body.data ? JSON.parse(req.body.data) : req.body;
    const { name } = data;

    let community = await Community.findById(req.params.id);
    if (!community && typeof req.params.id === "string") {
      community = await Community.findOne({ slug: req.params.id });
    }

    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    if (
      community.owner.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
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

    // 🎯 Crear notificaciones a seguidores de la comunidad
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
      console.log(
        `📢 Notificaciones creadas para ${followers.length} seguidores.`
      );
    }

    res.status(200).json({
      msg: "Comunidad actualizada exitosamente.",
      community,
    });
  } catch (error) {
    console.error("❌ Error al actualizar comunidad:", error);
    res.status(500).json({ msg: "Error al actualizar la comunidad." });
  }
};

/**
 * Elimina una comunidad.
 */
export const deleteCommunity = async (req, res) => {
  try {
    const community = await Community.findById(req.params.id);
    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    if (
      community.owner.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para eliminar esta comunidad." });
    }

    await community.deleteOne();

    res.status(200).json({ msg: "Comunidad eliminada exitosamente." });
  } catch (error) {
    console.error("❌ Error al eliminar comunidad:", error);
    res.status(500).json({ msg: "Error al eliminar la comunidad." });
  }
};

/**
 * Obtiene las comunidades del usuario autenticado.
 */
export const getMyCommunities = async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { owner: req.user.id };
    const communities = await Community.find(query);
    res.status(200).json({ communities });
  } catch (error) {
    console.error("❌ Error al obtener comunidades del usuario:", error);
    res.status(500).json({ msg: "Error al obtener comunidades." });
  }
};

/**
 * Obtiene una comunidad pública a través del slug.
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
    console.error("❌ Error al obtener comunidad por slug:", error);
    res.status(500).json({ msg: "Error al buscar comunidad por slug." });
  }
};

export const getCommunitySummary = async (req, res) => {
  const { id } = req.params;

  try {
    const objectId = new mongoose.Types.ObjectId(id);

    // 1️⃣ Total de seguidores
    const followersCount = await Follow.countDocuments({
      entityType: "community",
      entity: objectId,
    });

    // 2️⃣ Total de comentarios
    const commentsCount = await Comment.countDocuments({
      entityType: "community",
      entity: objectId,
    });

    // 3️⃣ Agrupación de ratings por cantidad de estrellas
    const ratingsAggregation = await Rating.aggregate([
      {
        $match: {
          entityType: "community",
          entity: objectId,
        },
      },
      {
        $group: {
          _id: "$value",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // 4️⃣ Promedio de rating
    const ratingsAll = await Rating.find({
      entityType: "community",
      entity: objectId,
    });

    const averageRating =
      ratingsAll.length > 0
        ? (
            ratingsAll.reduce((acc, r) => acc + r.value, 0) / ratingsAll.length
          ).toFixed(2)
        : null;

    res.json({
      followersCount,
      commentsCount,
      ratings: ratingsAggregation,
      averageRating,
    });
  } catch (error) {
    console.error("❌ Error en getCommunitySummary:", error);
    res
      .status(500)
      .json({ msg: "Error al obtener el resumen de la comunidad" });
  }
};
