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
  return { type: "Point", coordinates: [lng, lat] };
}
const tryParseJSON = (s) => {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

// Normaliza arrays de ids provenientes de múltiples formatos
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

const CLEAN = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// 🔁 Fallbacks de coordenadas
const FALLBACK_DALLAS = { lat: 32.7767, lng: -96.797 };

async function coordsFromCommunityOrDallas(communityId) {
  if (communityId) {
    const c = await Community.findById(communityId);
    const arr = c?.coordinates?.coordinates;
    if (
      Array.isArray(arr) &&
      arr.length === 2 &&
      arr.every((n) => typeof n === "number")
    ) {
      return { lat: arr[1], lng: arr[0] };
    }
  }
  return FALLBACK_DALLAS;
}

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

    // Normalizaciones
    categories = normalizeIdArrayField(categories);
    location = parseJSONField(location);
    contact = parseJSONField(contact);
    openingHours = parseJSONField(openingHours);
    tags = parseJSONField(tags, []);
    images = parseJSONField(images, []);
    serviceAreaZips = parseJSONField(serviceAreaZips, []);

    const communityDoc = await Community.findById(community);
    if (!communityDoc)
      return res.status(404).json({ msg: "Comunidad no encontrada." });

    // 📌 IMÁGENES: respeta lo que vino del parse (JSON) y/o imageProcessor (Cloudinary)
    if (!featuredImage && req.body.featuredImage)
      featuredImage = req.body.featuredImage;
    if (!profileImage && req.body.profileImage)
      profileImage = req.body.profileImage;

    if (Array.isArray(req.body.images) && req.body.images.length) {
      // fusiona galería si imageProcessor subió nuevas
      images = [...(Array.isArray(images) ? images : []), ...req.body.images];
    }

    // 🧭 Coordenadas SIEMPRE
    let coords = null;
    let locationPrecision = "address";

    if (isDeliveryOnly) {
      // Delivery-only → centroide del ZIP
      const zip = (primaryZip || location?.zipCode || "")
        .toString()
        .slice(0, 5);
      if (!/^\d{5}$/.test(zip)) {
        return res.status(400).json({
          msg: "Para negocios solo delivery, primaryZip (5 dígitos) es obligatorio.",
        });
      }
      const zc = await geocodeZipCentroid(zip, "US");
      if (!zc || typeof zc.lat !== "number" || typeof zc.lng !== "number") {
        // fallback: comunidad o Dallas
        const fb = await coordsFromCommunityOrDallas(community);
        coords = buildGeoJSON(fb);
      } else {
        coords = buildGeoJSON(zc);
      }

      location = {
        address: "",
        city: location?.city || "",
        state: location?.state || "",
        zipCode: zip,
        country: location?.country || "USA",
        coordinates: coords,
      };
      locationPrecision = "zipcode";
    } else {
      // Dirección física
      const adr = location?.address;
      const city = location?.city;
      const st = location?.state;
      const ctry = location?.country || "USA";

      if (adr && city && st) {
        try {
          const fullAddress = `${adr}, ${city}, ${st}, ${ctry}`;
          const g = await geocodeAddress(fullAddress);
          if (g && typeof g.lat === "number" && typeof g.lng === "number") {
            coords = buildGeoJSON(g);
          } else {
            const fb = await coordsFromCommunityOrDallas(community);
            coords = buildGeoJSON(fb);
          }
        } catch {
          const fb = await coordsFromCommunityOrDallas(community);
          coords = buildGeoJSON(fb);
        }
        location.coordinates = coords;
        if (!location.zipCode && primaryZip) location.zipCode = primaryZip;
      } else {
        // Dirección incompleta → fallback comunidad/Dallas
        const fb = await coordsFromCommunityOrDallas(community);
        coords = buildGeoJSON(fb);
        location = {
          address: adr || "",
          city: city || "",
          state: st || "",
          zipCode: location?.zipCode || primaryZip || "",
          country: ctry,
          coordinates: coords,
        };
      }
      locationPrecision = "address";
    }

    // 👤 Propietario
    const user = await User.findById(req.user.id);

    const newBusiness = new Business({
      name,
      description,
      categories,
      community,
      isDeliveryOnly: Boolean(isDeliveryOnly),
      primaryZip: primaryZip || location?.zipCode || "",
      serviceAreaZips,
      locationPrecision,
      location,
      contact: {
        phone: contact?.phone || "",
        email: CLEAN(contact?.email),
        website: CLEAN(contact?.website),
        socialMedia: {
          facebook: CLEAN(contact?.socialMedia?.facebook),
          instagram: CLEAN(contact?.socialMedia?.instagram),
          whatsapp: CLEAN(contact?.socialMedia?.whatsapp),
        },
      },
      openingHours,
      tags: Array.isArray(tags) ? tags : [],
      isVerified: isVerified ?? false,
      owner: user._id,
      featuredImage: featuredImage || "/placeholder-negocio.jpg",
      profileImage,
      images,
      isPremium: !!user.isPremium,
    });

    await newBusiness.save();

    // Promover a business_owner si aún es "user"
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
 * - Si NO envías lat/lng → devuelve paginado sin filtro geoespacial (recientes)
 * - Si envías lat/lng → filtra por radio geoespacial como antes
 */
export const getAllBusinesses = async (req, res) => {
  try {
    const { lat, lng, page = 1, limit = 15 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    if (!lat || !lng) {
      // 🔁 sin coordenadas → lista paginada por fecha (recientes)
      const [businesses, total] = await Promise.all([
        Business.find({})
          .populate("categories community owner")
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .skip(skip),
        Business.countDocuments({}),
      ]);

      return res.status(200).json({
        businesses,
        total,
        perPage: parseInt(limit),
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    }

    // 🧭 con coordenadas → búsqueda geoespacial
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

    // Recalcular ubicación si corresponde
    if (isDeliveryOnly === true || business.isDeliveryOnly === true) {
      const newZip = (
        primaryZip ||
        business.primaryZip ||
        location?.zipCode ||
        ""
      )
        .toString()
        .slice(0, 5);
      if (!/^\d{5}$/.test(newZip)) {
        return res.status(400).json({
          msg: "Para negocios solo delivery, primaryZip (5 dígitos) es obligatorio.",
        });
      }
      const zc = await geocodeZipCentroid(newZip, "US");
      const toUse =
        zc && typeof zc.lat === "number" && typeof zc.lng === "number"
          ? zc
          : await coordsFromCommunityOrDallas(community || business.community);

      location = {
        address: "",
        city: "",
        state: "",
        zipCode: newZip,
        country: "USA",
        coordinates: buildGeoJSON(toUse),
      };
      locationPrecision = "zipcode";
    } else if (location?.address && location?.city && location?.state) {
      try {
        const fullAddress = `${location.address}, ${location.city}, ${
          location.state
        }, ${location.country || "USA"}`;
        const g = await geocodeAddress(fullAddress);
        const toUse =
          g && typeof g.lat === "number" && typeof g.lng === "number"
            ? g
            : await coordsFromCommunityOrDallas(
                community || business.community
              );
        location.coordinates = buildGeoJSON(toUse);
        locationPrecision = "address";
      } catch (err) {
        console.error("❌ Error al geocodificar:", err);
        const fb = await coordsFromCommunityOrDallas(
          community || business.community
        );
        location = {
          ...(location || {}),
          coordinates: buildGeoJSON(fb),
        };
        locationPrecision = "address";
      }
    }

    // IMÁGENES: respeta las existentes si no se envían
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
    if (Array.isArray(req.body.images) && req.body.images.length) {
      images = [...(Array.isArray(images) ? images : []), ...req.body.images];
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

    if (typeof isDeliveryOnly === "boolean")
      business.isDeliveryOnly = isDeliveryOnly;
    if (typeof primaryZip === "string") business.primaryZip = primaryZip;
    if (Array.isArray(serviceAreaZips))
      business.serviceAreaZips = serviceAreaZips;
    if (location) business.location = location;
    business.locationPrecision = locationPrecision;

    await business.save();

    // Notificaciones a seguidores
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

    if (communityId) {
      query.community = communityId;
    }

    const businesses = await Business.find(query)
      .select(
        "_id name profileImage openingHours location.coordinates categories isPremium isDeliveryOnly locationPrecision primaryZip"
      )
      .populate({ path: "categories", select: "name" });

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
      .populate({ path: "categories", select: "name" });

    console.log("✅ Negocios encontrados:", businesses.length);

    res.status(200).json({ businesses });
  } catch (error) {
    console.error("❌ Error en getBusinessesForMapByCommunity:", error);
    res
      .status(500)
      .json({ msg: "Error al obtener negocios por comunidad para el mapa." });
  }
};
