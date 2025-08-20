// controllers/business.controller.js
import Business from "../models/business.model.js";
import Community from "../models/community.model.js";
import Notification from "../models/Notification.model.js";
import businessView from "../models/businessView.model.js";
import Follow from "../models/follow.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";

import { geocodeAddress } from "../utils/geocode.js";
import { geocodeZipCentroid } from "../utils/geocodeZip.js";
// 🎛️ Config de orden aleatorio
const PREMIUM_BOOST = Number(process.env.PREMIUM_BOOST ?? 0.08);
const DEFAULT_ORDER = (
  process.env.BIZ_DEFAULT_ORDER || "random_pfirst"
).toLowerCase();
const MAX_PREMIUM_PER_PAGE = Number(process.env.BIZ_MAX_PREMIUM_PER_PAGE ?? 2);

/* ───────── Cloudinary helpers ───────── */
function isCloudinaryUrl(url = "") {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("res.cloudinary.com") &&
      u.pathname.includes("/upload/")
    );
  } catch {
    return false;
  }
}
function getCloudinaryPublicId(url = "") {
  try {
    const path = new URL(url).pathname; // /<cloud>/image/upload/v123/folder/name.jpg
    const afterUpload = path.split("/upload/")[1];
    if (!afterUpload) return null;
    const parts = afterUpload.split("/");
    if (parts[0]?.startsWith("v") && /^\d+$/.test(parts[0].slice(1)))
      parts.shift(); // remove vNNN
    const file = parts.pop(); // name.jpg
    const name = file.replace(/\.[^.]+$/, "");
    const folder = parts.join("/");
    return folder ? `${folder}/${name}` : name;
  } catch {
    return null;
  }
}

/* ───────── Utils existentes ───────── */
const CLEAN = (v) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const tryParseJSON = (s) => {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
const parseJSONField = (field, fallback) => {
  try {
    return typeof field === "string" ? JSON.parse(field) : field;
  } catch {
    return fallback;
  }
};
const buildGeoJSON = ({ lng, lat }) => ({
  type: "Point",
  coordinates: [lng, lat],
});

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

function stripEmptyCoordinates(obj) {
  const arr = obj?.location?.coordinates?.coordinates;
  if (Array.isArray(arr) && arr.length === 0) {
    delete obj.location.coordinates;
  }
}

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

/* ───────── Create ───────── */
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
    location = parseJSONField(location, {});
    contact = parseJSONField(contact, {});
    openingHours = parseJSONField(openingHours, undefined);
    tags = parseJSONField(tags, []);
    images = parseJSONField(images, []);
    serviceAreaZips = parseJSONField(serviceAreaZips, []);

    const communityDoc = await Community.findById(community);
    if (!communityDoc)
      return res.status(404).json({ msg: "Comunidad no encontrada." });

    // Imágenes resultantes de imageProcessor (usar solo lo que dejó el middleware)
    if (!featuredImage && req.body.featuredImage)
      featuredImage = req.body.featuredImage;
    if (!profileImage && req.body.profileImage)
      profileImage = req.body.profileImage;
    if (Array.isArray(req.body.images)) {
      images = req.body.images;
    }

    // GEO
    let locationPrecision = "address";
    stripEmptyCoordinates({ location });
    const hasPhysicalAddress = Boolean(
      location?.address && location?.city && location?.state
    );

    if (!isDeliveryOnly && hasPhysicalAddress) {
      const fullAddress = `${location.address}, ${location.city}, ${
        location.state
      }, ${location.country || "USA"}`;
      let point;
      try {
        const g = await geocodeAddress(fullAddress);
        point =
          g && typeof g.lat === "number" && typeof g.lng === "number"
            ? buildGeoJSON(g)
            : buildGeoJSON(await coordsFromCommunityOrDallas(community));
      } catch {
        point = buildGeoJSON(await coordsFromCommunityOrDallas(community));
      }
      location = {
        ...location,
        country: location?.country || "USA",
        coordinates: point,
      };
      locationPrecision = "address";
    } else if (isDeliveryOnly) {
      const zip = (primaryZip || location?.zipCode || "")
        .toString()
        .slice(0, 5);
      if (!/^\d{5}$/.test(zip)) {
        return res.status(400).json({
          msg: "Para negocios solo delivery, primaryZip (5 dígitos) es obligatorio.",
        });
      }
      const zc = await geocodeZipCentroid(zip, "US");
      const base =
        zc && typeof zc.lat === "number" && typeof zc.lng === "number"
          ? zc
          : await coordsFromCommunityOrDallas(community);
      location = {
        address: "",
        city: location?.city || "",
        state: location?.state || "",
        zipCode: zip,
        country: location?.country || "USA",
        coordinates: buildGeoJSON(base),
      };
      locationPrecision = "zipcode";
    } else {
      return res.status(400).json({
        msg: "Debes enviar dirección completa o (delivery-only) un ZIP válido.",
      });
    }

    // Propietario = usuario autenticado
    const user = await User.findById(req.user.id);

    const newBusiness = new Business({
      name,
      description,
      categories,
      community,
      isDeliveryOnly: Boolean(isDeliveryOnly),
      primaryZip: primaryZip || location?.zipCode || "",
      serviceAreaZips: Array.isArray(serviceAreaZips) ? serviceAreaZips : [],
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

/* ───────── Listado ───────── */

export const getAllBusinesses = async (req, res) => {
  try {
    const { lat, lng, page = 1, limit = 15, order } = req.query;
    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(parseInt(limit, 10) || 15, 100);
    const skip = (pg - 1) * lim;
    const mode = String(order || DEFAULT_ORDER).toLowerCase();

    // MATCH (geo opcional)
    const match = {};
    if (lat && lng) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      const radiusInMiles = 80;
      const earthRadiusInMiles = 3963.2;
      const radiusInRadians = radiusInMiles / earthRadiusInMiles;
      match["location.coordinates"] = {
        $geoWithin: {
          $centerSphere: [[parsedLng, parsedLat], radiusInRadians],
        },
      };
    }

    // Conteo total (para paginación)
    const total = await Business.countDocuments(match);

    // Helpers para traer "bloques" barajados
    const fetchChunk = async (isPrem, sk, limi) => {
      if (limi <= 0) return [];
      const m = {
        ...match,
        ...(isPrem ? { isPremium: true } : { isPremium: { $ne: true } }),
      };
      return Business.aggregate([
        { $match: m },
        { $addFields: { _r: { $rand: {} } } },
        { $sort: { _r: 1, _id: 1 } },
        { $skip: Math.max(sk, 0) },
        { $limit: limi },
      ]);
    };

    // Lógica de mezcla con tope premium por página
    const capPrem = Math.min(MAX_PREMIUM_PER_PAGE, lim);
    const baseNonNeed = lim - capPrem;

    // Skips "estratificados" por página
    const premSkip = (pg - 1) * capPrem;
    const nonSkip = (pg - 1) * baseNonNeed;

    // 1) Traer bloques iniciales
    let prem = await fetchChunk(true, premSkip, capPrem);
    let non = await fetchChunk(false, nonSkip, baseNonNeed);

    // 2) Rellenos si faltan piezas
    // Si faltan premium, intenta compensar con no-premium extra
    if (prem.length < capPrem) {
      const need = Math.min(
        capPrem - prem.length,
        lim - (prem.length + non.length)
      );
      if (need > 0) {
        const extraNon = await fetchChunk(false, nonSkip + non.length, need);
        non = non.concat(extraNon);
      }
    }
    // Si faltan no-premium, intenta traer no-premium extra (no subimos premium por el tope "máximo")
    if (non.length < baseNonNeed) {
      const need = baseNonNeed - non.length;
      if (need > 0) {
        const extraNon = await fetchChunk(false, nonSkip + non.length, need);
        non = non.concat(extraNon);
      }
    }

    // 3) Combinar según modo
    let merged;
    if (mode === "random_pfirst") {
      // Premium primero (aleatorios entre sí) pero máximo capPrem; luego no-premium
      merged = prem.concat(non).slice(0, lim);
    } else {
      // "random": mezcla por score (aleatorio + boost leve a premium), respetando tope
      const pool = prem.concat(non);
      pool.sort((a, b) => {
        const sa = (a._r || 0) + (a.isPremium ? PREMIUM_BOOST : 0);
        const sb = (b._r || 0) + (b.isPremium ? PREMIUM_BOOST : 0);
        if (sb !== sa) return sb - sa;
        return String(a._id).localeCompare(String(b._id));
      });
      const out = [];
      let usedPrem = 0;
      for (const doc of pool) {
        if (out.length >= lim) break;
        if (doc.isPremium) {
          if (usedPrem >= capPrem) continue; // respeta tope
          usedPrem++;
        }
        out.push(doc);
      }
      // Si aún falta llenar (muy raro), intenta no-premium extra
      if (out.length < lim) {
        const extra = await fetchChunk(
          false,
          nonSkip + non.length,
          lim - out.length
        );
        merged = out.concat(extra).slice(0, lim);
      } else {
        merged = out;
      }
    }

    // 4) Populate y respuesta
    const businesses = await Business.populate(merged, [
      { path: "categories", select: "name" },
      { path: "community" },
      { path: "owner" },
    ]);

    return res.status(200).json({
      businesses,
      total,
      perPage: lim,
      page: pg,
      totalPages: Math.ceil(total / lim),
    });
  } catch (error) {
    console.error("❌ Error en getAllBusinesses:", error);
    res.status(500).json({ msg: "Error al obtener negocios." });
  }
};

/* ───────── Detail ───────── */
export const getBusinessById = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id).populate(
      "categories  community owner"
    );
    if (!business)
      return res.status(404).json({ msg: "Negocio no encontrado." });

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

/* ───────── Update (galería mixta con límite 5) ───────── */
export const updateBusiness = async (req, res) => {
  try {
    // Logs de entrada
    console.log("🧩 BODY KEYS:", Object.keys(req.body || {}));
    console.log("🧩 FILES KEYS:", Object.keys(req.files || {}));
    console.log(
      "🧪 imageProcessor.body.featuredImage:",
      req.body?.featuredImage
    );
    console.log("🧪 imageProcessor.body.profileImage:", req.body?.profileImage);
    console.log(
      "🧪 imageProcessor.body.images count:",
      Array.isArray(req.body?.images) ? req.body.images.length : 0
    );

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
      owner, // no permitido cambiar
      isDeliveryOnly,
      primaryZip,
      serviceAreaZips,
      existingImages, // set final de la UI (puede venir como string JSON)
    } = req.body;

    // Parse/normalize
    categories = normalizeIdArrayField(categories);
    location = parseJSONField(location, undefined);
    contact = parseJSONField(contact, undefined);
    openingHours = parseJSONField(openingHours, undefined);
    tags = parseJSONField(tags, undefined);
    images = parseJSONField(images, undefined);
    serviceAreaZips = parseJSONField(serviceAreaZips, undefined);

    const existingProvided = Object.prototype.hasOwnProperty.call(
      req.body,
      "existingImages"
    );
    // Log clave: ¿vino existingImages del front?
    console.log("raw existingImages body:", req.body.existingImages);
    console.log("existingProvided:", existingProvided);

    const business = await Business.findById(req.params.id);
    if (!business)
      return res.status(404).json({ msg: "Negocio no encontrado." });

    const isOwner = business.owner.toString() === req.user.id;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para actualizar este negocio." });
    }

    if (owner && owner !== business.owner.toString()) {
      return res
        .status(400)
        .json({ msg: "No puedes cambiar el propietario del negocio." });
    }

    // LIMPIEZA: evita coordinates: []
    if (location) stripEmptyCoordinates({ location });

    // GEO RULES
    let locationPrecision = business.locationPrecision;

    if (isDeliveryOnly === true) {
      const zip = (primaryZip || business.primaryZip || location?.zipCode || "")
        .toString()
        .slice(0, 5);
      if (!/^\d{5}$/.test(zip)) {
        return res.status(400).json({
          msg: "Para negocios solo delivery, primaryZip (5 dígitos) es obligatorio.",
        });
      }
      const zc = await geocodeZipCentroid(zip, "US");
      const base =
        zc && typeof zc.lat === "number" && typeof zc.lng === "number"
          ? zc
          : await coordsFromCommunityOrDallas(community || business.community);
      location = {
        address: "",
        city: "",
        state: "",
        zipCode: zip,
        country: "USA",
        coordinates: buildGeoJSON(base),
      };
      locationPrecision = "zipcode";
    } else if (isDeliveryOnly === false) {
      const hasAddress = Boolean(
        location?.address && location?.city && location?.state
      );
      if (hasAddress) {
        const fullAddress = `${location.address}, ${location.city}, ${
          location.state
        }, ${location.country || "USA"}`;
        try {
          const g = await geocodeAddress(fullAddress);
          const base =
            g && typeof g.lat === "number" && typeof g.lng === "number"
              ? g
              : await coordsFromCommunityOrDallas(
                  community || business.community
                );
          location.coordinates = buildGeoJSON(base);
          locationPrecision = "address";
        } catch {
          const fb = await coordsFromCommunityOrDallas(
            community || business.community
          );
          location = { ...(location || {}), coordinates: buildGeoJSON(fb) };
          locationPrecision = "address";
        }
      } else {
        location = undefined;
      }
    } else if (location?.address && location?.city && location?.state) {
      const fullAddress = `${location.address}, ${location.city}, ${
        location.state
      }, ${location.country || "USA"}`;
      try {
        const g = await geocodeAddress(fullAddress);
        const base =
          g && typeof g.lat === "number" && typeof g.lng === "number"
            ? g
            : await coordsFromCommunityOrDallas(
                community || business.community
              );
        location.coordinates = buildGeoJSON(base);
        locationPrecision = "address";
      } catch {
        const fb = await coordsFromCommunityOrDallas(
          community || business.community
        );
        location = { ...(location || {}), coordinates: buildGeoJSON(fb) };
        locationPrecision = "address";
      }
    } else {
      location = undefined;
    }

    /* ---------- IMÁGENES ---------- */
    const prevFeatured = business.featuredImage;
    const prevProfile = business.profileImage;
    const prevGallery = Array.isArray(business.images) ? business.images : [];

    // Portada (si vino una nueva por file, imageProcessor ya puso URL)
    let nextFeatured = prevFeatured;
    if (typeof featuredImage === "string" && featuredImage.trim()) {
      nextFeatured = featuredImage.trim();
    }

    // Perfil
    let nextProfile = prevProfile;
    if (typeof profileImage === "string" && profileImage.trim()) {
      nextProfile = profileImage.trim();
    }

    // existingImages: respeta si vino (aunque sea "[]"); si no vino, no tocar galería
    existingImages = parseJSONField(
      existingImages,
      existingProvided ? [] : undefined
    );

    const MAX_GALLERY = 5;

    // Set final que dejó el usuario en UI
    const keepInput = Array.isArray(existingImages)
      ? existingImages
      : prevGallery;

    // URLs nuevas agregadas por imageProcessor en ESTA request
    const newUrls = Array.isArray(images) ? images : [];

    // Normaliza keep
    const seen = new Set();
    const keep = [];
    for (const u of keepInput) {
      if (typeof u === "string" && u && !seen.has(u)) {
        seen.add(u);
        keep.push(u);
      }
    }

    // Cupos y resultado final (máx 5)
    const slots = Math.max(0, MAX_GALLERY - keep.length);
    const acceptedNew = newUrls.slice(0, slots);
    const overflowNew = newUrls.slice(slots);
    const nextGallery = [...keep, ...acceptedNew];

    // Logs de galería (antes de asignar)
    console.log("prevGallery:", prevGallery.length, prevGallery);
    console.log("keepInput (existingImages):", keep.length, keep);
    console.log("newUrls (subidas):", newUrls.length, newUrls);
    console.log("nextGallery:", nextGallery.length, nextGallery);
    console.log(
      "overflowNew (no entran por tope):",
      overflowNew.length,
      overflowNew
    );

    // Asignación y guardado
    if (name !== undefined) business.name = name;
    if (description !== undefined) business.description = description;
    if (categories && categories.length) business.categories = categories;
    if (community !== undefined) business.community = community;
    if (contact !== undefined) business.contact = contact;
    if (openingHours !== undefined) business.openingHours = openingHours;
    if (tags !== undefined) business.tags = tags;
    if (typeof isVerified === "boolean") business.isVerified = isVerified;
    if (typeof isDeliveryOnly === "boolean")
      business.isDeliveryOnly = isDeliveryOnly;
    if (typeof primaryZip === "string") business.primaryZip = primaryZip;
    if (Array.isArray(serviceAreaZips))
      business.serviceAreaZips = serviceAreaZips;
    if (location) business.location = location;
    if (typeof nextFeatured === "string") business.featuredImage = nextFeatured;
    if (typeof nextProfile === "string") business.profileImage = nextProfile;
    business.images = nextGallery;
    business.locationPrecision = locationPrecision;

    await business.save();

    /* ---------- BORRADOS EN CLOUDINARY (best-effort) ---------- */
    const uploadedByFile = req._uploadedByFile || {};
    const uploadedPublicIds = req._uploadedPublicIds || { gallery: [] };

    // 1) Portada: borra anterior si reemplazada y nueva vino por FILE
    if (
      nextFeatured !== prevFeatured &&
      uploadedByFile.featuredImage &&
      prevFeatured &&
      isCloudinaryUrl(prevFeatured)
    ) {
      const pid = getCloudinaryPublicId(prevFeatured);
      console.log("🧹 Borrar featured anterior:", pid);
      if (pid) {
        cloudinary.uploader
          .destroy(pid)
          .catch((e) =>
            console.warn(
              "⚠️ No se pudo borrar featured anterior:",
              pid,
              e?.message
            )
          );
      }
    }

    // 2) Perfil
    if (
      nextProfile !== prevProfile &&
      uploadedByFile.profileImage &&
      prevProfile &&
      isCloudinaryUrl(prevProfile)
    ) {
      const pid = getCloudinaryPublicId(prevProfile);
      console.log("🧹 Borrar profile anterior:", pid);
      if (pid) {
        cloudinary.uploader
          .destroy(pid)
          .catch((e) =>
            console.warn(
              "⚠️ No se pudo borrar profile anterior:",
              pid,
              e?.message
            )
          );
      }
    }

    // 3a) Galería: borra viejas removidas (prev - keep)
    const removedOld = prevGallery.filter((url) => !keep.includes(url));
    const removedOldPids = removedOld
      .filter(isCloudinaryUrl)
      .map(getCloudinaryPublicId)
      .filter(Boolean);

    console.log("removedOld:", removedOld.length, removedOld);
    console.log("removedOldPids:", removedOldPids);

    if (removedOldPids.length) {
      cloudinary.api
        .delete_resources(removedOldPids)
        .catch((e) =>
          console.warn(
            "⚠️ No se pudieron borrar imágenes removidas (old):",
            e?.message
          )
        );
    }

    // 3b) Overflow de nuevas (si subiste y no entraron por tope)
    if (
      Array.isArray(uploadedPublicIds.gallery) &&
      uploadedPublicIds.gallery.length
    ) {
      console.log("uploadedPublicIds.gallery:", uploadedPublicIds.gallery);
      const overflowPids = uploadedPublicIds.gallery
        .filter((item) => overflowNew.includes(item.url))
        .map((item) => item.public_id)
        .filter(Boolean);

      console.log("overflowPids:", overflowPids);

      if (overflowPids.length) {
        cloudinary.api
          .delete_resources(overflowPids)
          .catch((e) =>
            console.warn(
              "⚠️ No se pudieron borrar imágenes overflow (nuevas):",
              e?.message
            )
          );
      }
    }

    // Respuesta poblada
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

/* ───────── Delete ───────── */
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

    // Intenta borrar recursos en Cloudinary (best-effort)
    const toDelete = [];
    if (business.featuredImage && isCloudinaryUrl(business.featuredImage)) {
      const pid = getCloudinaryPublicId(business.featuredImage);
      if (pid) toDelete.push(pid);
    }
    if (business.profileImage && isCloudinaryUrl(business.profileImage)) {
      const pid = getCloudinaryPublicId(business.profileImage);
      if (pid) toDelete.push(pid);
    }
    if (Array.isArray(business.images)) {
      business.images.forEach((url) => {
        if (isCloudinaryUrl(url)) {
          const pid = getCloudinaryPublicId(url);
          if (pid) toDelete.push(pid);
        }
      });
    }
    if (toDelete.length) {
      cloudinary.api
        .delete_resources(toDelete)
        .catch((e) =>
          console.warn("⚠️ No se pudieron borrar recursos:", e?.message)
        );
    }

    await business.deleteOne();
    res.status(200).json({ msg: "Negocio eliminado exitosamente." });
  } catch (error) {
    console.error("❌ Error en deleteBusiness:", error);
    res.status(500).json({ msg: "Error al eliminar el negocio." });
  }
};

/* ───────── Mine ───────── */
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

/* ───────── Promotions by Business ───────── */
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

    if (!negocio) return res.status(404).json({ msg: "Negocio no encontrado" });

    res.json({ promotions: negocio.promotions });
  } catch (error) {
    console.error("❌ Error en getPromotionsByBusiness:", error);
    res.status(500).json({ msg: "Error interno del servidor" });
  }
};

/* ───────── Toggle Like ───────── */
export const toggleLikeBusiness = async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business)
      return res.status(404).json({ error: "Negocio no encontrado" });

    const userId = req.user._id.toString();
    const index = business.likes.findIndex((id) => id.toString() === userId);

    let liked;
    if (index === -1) {
      business.likes.push(userId);
      liked = true;
    } else {
      business.likes.splice(index, 1);
      liked = false;
    }

    await business.save();
    res.json({ likesCount: business.likes.length, liked });
  } catch (error) {
    console.error("❌ Error en toggleLikeBusiness:", error);
    res.status(500).json({ error: "Error al procesar el me gusta" });
  }
};

/* ───────── By Community (geo within) ───────── */
export const getBusinessesByCommunity = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const { communityId } = req.params;

    if (!lat || !lng)
      return res.status(400).json({ msg: "Faltan coordenadas del usuario." });

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
    if (communityId) query.community = communityId;

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

/* ───────── Map by Community ───────── */
export const getBusinessesForMapByCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { lat, lng } = req.query;

    if (!communityId || !lat || !lng) {
      return res.status(400).json({ msg: "Faltan parámetros requeridos." });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
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

    const businesses = await Business.find(query)
      .select(
        "_id name profileImage openingHours location.coordinates categories isPremium isDeliveryOnly locationPrecision primaryZip"
      )
      .populate({ path: "categories", select: "name" });

    res.status(200).json({ businesses });
  } catch (error) {
    console.error("❌ Error en getBusinessesForMapByCommunity:", error);
    res
      .status(500)
      .json({ msg: "Error al obtener negocios por comunidad para el mapa." });
  }
};
