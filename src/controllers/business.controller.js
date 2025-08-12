// controllers/business.controller.js
import Business from "../models/business.model.js";
import Community from "../models/community.model.js";
import Notification from "../models/Notification.model.js";
import { geocodeAddress } from "../utils/geocode.js";
import businessView from "../models/businessView.model.js";
import Follow from "../models/follow.model.js";
import User from "../models/user.model.js";
import { geocodeZipCentroid } from "../utils/geocodeZip.js";

// Utils
function buildGeoJSON({ lng, lat }) {
  return {
    type: "Point",
    coordinates: [lng, lat],
  };
}
const tryParseJSON = (s) => {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

// Normaliza casos como: ['["id1","id2"]','["id1","id2"]'] -> ['id1','id2','id1','id2']
// También soporta: '["id1","id2"]' (string plano) -> ['id1','id2']
function normalizeIdArrayField(field) {
  let out = [];

  if (Array.isArray(field)) {
    for (const item of field) {
      if (typeof item === "string") {
        const parsed = tryParseJSON(item);
        if (Array.isArray(parsed)) out.push(...parsed);
        else if (/^[0-9a-fA-F]{24}$/.test(item)) out.push(item);
      } else if (Array.isArray(item)) {
        out.push(...item);
      } else if (item && typeof item === "object" && item._id) {
        out.push(String(item._id));
      }
    }
  } else if (typeof field === "string") {
    const parsed = tryParseJSON(field);
    if (Array.isArray(parsed)) out = parsed;
    else if (/^[0-9a-fA-F]{24}$/.test(field)) out = [field];
  } else if (field && typeof field === "object" && field._id) {
    out = [String(field._id)];
  }

  // Filtra a ids válidos y de‑duplica
  const onlyIds = out.map(String).filter((x) => /^[0-9a-fA-F]{24}$/.test(x));
  return Array.from(new Set(onlyIds));
}

const parseJSONField = (field, fallback = {}) => {
  try {
    return typeof field === "string" ? JSON.parse(field) : field;
  } catch {
    return fallback;
  }
};

/**
 * Crear un nuevo negocio
 */
export const createBusiness = async (req, res) => {
  try {
    if (!["admin", "business_owner", "user"].includes(req.user.role)) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para crear un negocio." });
    }

    let {
      name,
      description,
      categories,
      community,
      location,
      contact,
      openingHours,
      tags,
      isVerified,
      featuredImage = "",
      profileImage = "",
      images = [],
      isDeliveryOnly = false,
      primaryZip = "",
      serviceAreaZips = [],
    } = req.body;

    categories = normalizeIdArrayField(categories);
    location = parseJSONField(location);
    contact = parseJSONField(contact);
    openingHours = parseJSONField(openingHours);
    tags = parseJSONField(tags);
    images = parseJSONField(images);
    serviceAreaZips = parseJSONField(serviceAreaZips, []);

    const communityDoc = await Community.findById(community);
    if (!communityDoc)
      return res.status(404).json({ msg: "Comunidad no encontrada." });

    let locationPrecision = "address";

    if (!isDeliveryOnly) {
      // flujo normal con dirección exacta
      if (!location?.address || !location?.city || !location?.state) {
        return res
          .status(400)
          .json({ msg: "Dirección incompleta para geocodificación." });
      }
      const fullAddress = `${location.address}, ${location.city}, ${
        location.state
      }, ${location.country || "USA"}`;
      const coords = await geocodeAddress(fullAddress);
      location.coordinates = buildGeoJSON(coords);
      locationPrecision = "address";
      // Asegura zipCode si viene
      if (!location.zipCode && primaryZip) location.zipCode = primaryZip;
    } else {
      // solo delivery: geocodificar centroid del ZIP
      if (!primaryZip || !/^\d{5}$/.test(primaryZip)) {
        return res.status(400).json({
          msg: "Para negocios solo delivery, primaryZip (5 dígitos) es obligatorio.",
        });
      }
      const coords = await geocodeZipCentroid(primaryZip, "US");
      location = {
        address: "",
        city: "",
        state: "",
        zipCode: primaryZip,
        country: "USA",
        coordinates: buildGeoJSON(coords),
      };
      locationPrecision = "zipcode";
    }

    const user = await User.findById(req.user.id);

    const newBusiness = new Business({
      name,
      description,
      categories,
      community,
      isDeliveryOnly,
      primaryZip,
      serviceAreaZips,
      locationPrecision,
      location,
      contact,
      openingHours,
      tags,
      isVerified: isVerified ?? false,
      owner: user._id,
      featuredImage,
      profileImage,
      images,
      isPremium: user.isPremium,
    });

    await newBusiness.save();

    if (user.role === "user") {
      user.role = "business_owner";
      await user.save();
    }

    const populatedBusiness = await Business.findById(newBusiness._id).populate(
      "categories community owner"
    );

    res.status(201).json({
      msg: "Negocio creado exitosamente.",
      business: populatedBusiness,
    });
  } catch (error) {
    console.error("❌ Error en createBusiness:", error);
    res.status(500).json({ msg: "Error al crear el negocio." });
  }
};

/**
 * Obtener todos los negocios
 */
export const getAllBusinesses = async (req, res) => {
  try {
    const { lat, lng, page = 1, limit = 15 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (!lat || !lng) {
      return res.status(400).json({ msg: "Faltan coordenadas del usuario." });
    }

    const radiusInMiles = 80;
    const earthRadiusInMiles = 3963.2;
    const radiusInRadians = radiusInMiles / earthRadiusInMiles;

    const query = {
      "location.coordinates": {
        $geoWithin: {
          $centerSphere: [[parsedLng, parsedLat], radiusInRadians],
        },
      },
    };

    const [businesses, total] = await Promise.all([
      Business.find(query)
        .populate("categories community owner")
        .limit(parseInt(limit))
        .skip(skip),
      Business.countDocuments(query),
    ]);

    res.status(200).json({
      businesses,
      total,
      perPage: parseInt(limit),
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error("❌ Error en getAllBusinesses:", error);
    res.status(500).json({ msg: "Error al obtener negocios cercanos." });
  }
};

/**
 * Obtener un negocio por ID
 */
export const getBusinessById = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).populate(
      "categories  community owner"
    );

    if (!business) {
      return res.status(404).json({ msg: "Negocio no encontrado." });
    }

    await businessView.create({
      business: business._id,
      viewer: req.user ? req.user._id : null,
      isAnonymous: !req.user,
      viewedAt: new Date(),
    });

    res.status(200).json({ business });
  } catch (error) {
    console.error("❌ Error en getBusinessById:", error);
    res.status(500).json({ msg: "Error al obtener el negocio." });
  }
};

/**
 * Actualizar un negocio
 */
export const updateBusiness = async (req, res) => {
  try {
    let {
      name,
      description,
      categories,
      community,
      location,
      contact,
      openingHours,
      tags,
      images,
      isVerified,
      featuredImage,
      profileImage,
      owner,
      isDeliveryOnly,
      primaryZip,
      serviceAreaZips,
    } = req.body;

    categories = normalizeIdArrayField(categories);
    location = parseJSONField(location);
    contact = parseJSONField(contact);
    openingHours = parseJSONField(openingHours);
    tags = parseJSONField(tags);
    images = parseJSONField(images);
    serviceAreaZips = parseJSONField(serviceAreaZips);

    const business = await Business.findById(req.params.id);
    if (!business)
      return res.status(404).json({ msg: "Negocio no encontrado." });

    const isOwner = business.owner.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin)
      return res
        .status(403)
        .json({ msg: "No tienes permisos para actualizar este negocio." });

    if (owner && owner !== business.owner.toString()) {
      return res
        .status(400)
        .json({ msg: "No puedes cambiar el propietario del negocio." });
    }

    let locationPrecision = business.locationPrecision;

    // Determinar si cambiamos geolocalización
    if (isDeliveryOnly === true || business.isDeliveryOnly === true) {
      // delivery-only en la nueva versión o ya lo era
      const newZip = primaryZip || business.primaryZip;
      if (!newZip || !/^\d{5}$/.test(newZip)) {
        return res.status(400).json({
          msg: "Para negocios solo delivery, primaryZip (5 dígitos) es obligatorio.",
        });
      }
      const coords = await geocodeZipCentroid(newZip, "US");
      location = {
        address: "",
        city: "",
        state: "",
        zipCode: newZip,
        country: "USA",
        coordinates: buildGeoJSON(coords),
      };
      locationPrecision = "zipcode";
    } else if (location?.address && location?.city && location?.state) {
      // negocio con dirección exacta
      try {
        const fullAddress = `${location.address}, ${location.city}, ${
          location.state
        }, ${location.country || "USA"}`;
        const coords = await geocodeAddress(fullAddress);
        location.coordinates = buildGeoJSON(coords);
        locationPrecision = "address";
      } catch (err) {
        console.error("❌ Error al geocodificar:", err);
        return res
          .status(400)
          .json({ msg: "No se pudo obtener coordenadas para la dirección." });
      }
    }

    featuredImage =
      req.body.featuredImage ||
      req.body.featuredImageUrl ||
      business.featuredImage;
    profileImage =
      req.body.profileImage ||
      req.body.profileImageUrl ||
      business.profileImage;
    if (req.body.existingImages) {
      images = parseJSONField(req.body.existingImages, business.images);
    }

    Object.assign(business, {
      name,
      description,
      categories,
      community,
      contact,
      openingHours,
      tags,
      isVerified:
        typeof isVerified === "boolean" ? isVerified : business.isVerified,
      featuredImage,
      profileImage,
      images,
    });

    // Actualiza flags/ZIP y ubicación
    if (typeof isDeliveryOnly === "boolean")
      business.isDeliveryOnly = isDeliveryOnly;
    if (typeof primaryZip === "string") business.primaryZip = primaryZip;
    if (Array.isArray(serviceAreaZips))
      business.serviceAreaZips = serviceAreaZips;
    if (location) business.location = location;
    business.locationPrecision = locationPrecision;

    await business.save();

    // Notifica a seguidores (igual que tu código)
    const followers = await Follow.find({
      entityType: "business",
      entityId: business._id,
    });
    if (followers.length > 0) {
      const notifications = followers.map((f) => ({
        user: f.user,
        actionType: "business_updated",
        entityType: "business",
        entityId: business._id,
        message: `El negocio "${business.name}" actualizó su información.`,
        link: `/negocios/${business._id}`,
        read: false,
      }));
      await Notification.insertMany(notifications);
    }

    const populated = await Business.findById(business._id).populate(
      "categories  community owner"
    );

    res
      .status(200)
      .json({ msg: "Negocio actualizado exitosamente.", business: populated });
  } catch (error) {
    console.error("❌ Error en updateBusiness:", error);
    res.status(500).json({ msg: "Error al actualizar el negocio." });
  }
};

/**
 * Eliminar un negocio
 */
export const deleteBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business)
      return res.status(404).json({ msg: "Negocio no encontrado." });

    const isOwner = business.owner.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para eliminar este negocio." });
    }

    await business.deleteOne();
    res.status(200).json({ msg: "Negocio eliminado exitosamente." });
  } catch (error) {
    console.error("❌ Error en deleteBusiness:", error);
    res.status(500).json({ msg: "Error al eliminar el negocio." });
  }
};

/**
 * Obtener negocios del usuario autenticado
 */
export const getMyBusinesses = async (req, res) => {
  try {
    const businesses = await Business.find({ owner: req.user.id }).populate(
      "categories community owner"
    );

    res.status(200).json({ businesses });
  } catch (error) {
    console.error("❌ Error en getMyBusinesses:", error);
    res.status(500).json({ msg: "Error al obtener tus negocios." });
  }
};

/**
 * Obtener promociones por negocio
 */
export const getPromotionsByBusiness = async (req, res) => {
  try {
    const negocio = await Business.findById(req.params.id)
      .populate({
        path: "promotions",
        populate: [
          { path: "category", select: "name" },
          { path: "community", select: "name" },
        ],
      })
      .select("name promotions");

    if (!negocio) {
      return res.status(404).json({ msg: "Negocio no encontrado" });
    }

    res.json({ promotions: negocio.promotions });
  } catch (error) {
    console.error("❌ Error en getPromotionsByBusiness:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

/**
 * Alternar like a un negocio
 */
export const toggleLikeBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: "Negocio no encontrado" });
    }

    const userId = req.user._id.toString();
    const index = business.likes.findIndex((id) => id.toString() === userId);

    if (index === -1) {
      business.likes.push(userId);
    } else {
      business.likes.splice(index, 1);
    }

    await business.save();

    res.json({
      likesCount: business.likes.length,
      liked: index === -1,
    });
  } catch (error) {
    console.error("❌ Error en toggleLikeBusiness:", error);
    res.status(500).json({ error: "Error al procesar el me gusta" });
  }
};

export const getBusinessesByCommunity = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const { communityId } = req.params;

    if (!lat || !lng) {
      return res.status(400).json({ msg: "Faltan coordenadas del usuario." });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const radiusInMiles = 80;
    const earthRadiusInMiles = 3963.2;
    const radiusInRadians = radiusInMiles / earthRadiusInMiles;

    const query = {
      "location.coordinates": {
        $geoWithin: {
          $centerSphere: [[parsedLng, parsedLat], radiusInRadians],
        },
      },
    };

    // ✅ Agregar filtro por comunidad si se proporciona
    if (communityId) {
      query.community = communityId;
    }

    const businesses = await Business.find(query)
      .select(
        "_id name profileImage openingHours location.coordinates categories isPremium isDeliveryOnly locationPrecision primaryZip"
      )

      .populate({
        path: "categories",
        select: "name",
      });

    res.status(200).json({ businesses });
  } catch (error) {
    console.error("❌ Error en getAllBusinessesForMap:", error);
    res.status(500).json({ msg: "Error al obtener negocios para el mapa." });
  }
};

// ✅ GET /api/businesses/map
export const getBusinessesForMapByCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { lat, lng } = req.query;

    console.log("🌐 communityId:", communityId);
    console.log("📍 lat:", lat, "lng:", lng);

    if (!communityId || !lat || !lng) {
      console.warn("⚠️ Faltan parámetros requeridos");
      return res.status(400).json({ msg: "Faltan parámetros requeridos." });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      console.warn("⚠️ Coordenadas inválidas:", { parsedLat, parsedLng });
      return res.status(400).json({ msg: "Coordenadas inválidas." });
    }

    const radiusInMiles = 80;
    const earthRadiusInMiles = 3963.2;
    const radiusInRadians = radiusInMiles / earthRadiusInMiles;

    const query = {
      community: communityId,
      "location.coordinates": {
        $geoWithin: {
          $centerSphere: [[parsedLng, parsedLat], radiusInRadians],
        },
      },
    };

    console.log("🧪 Query:", JSON.stringify(query, null, 2));

    const businesses = await Business.find(query)
      .select(
        "_id name profileImage openingHours location.coordinates categories isPremium isDeliveryOnly locationPrecision primaryZip"
      )

      .populate({
        path: "categories",
        select: "name",
      });

    console.log("✅ Negocios encontrados:", businesses.length);

    res.status(200).json({ businesses });
  } catch (error) {
    console.error("❌ Error en getBusinessesForMapByCommunity:", error);
    res
      .status(500)
      .json({ msg: "Error al obtener negocios por comunidad para el mapa." });
  }
};
