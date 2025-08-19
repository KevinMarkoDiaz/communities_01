import mongoose from "mongoose";
import Event from "../models/event.model.js";
import Business from "../models/business.model.js";
import Notification from "../models/Notification.model.js";
import Follow from "../models/follow.model.js";
import { geocodeAddress } from "../utils/geocode.js";
import EventView from "../models/eventView.model.js";
import Rating from "../models/rating.model.js";
import Comment from "../models/comment.model.js";
import Community from "../models/community.model.js";
import { v2 as cloudinary } from "cloudinary"; // 👈 NUEVO

// 🎛️ Config de orden
const PREMIUM_BOOST = Number(process.env.PREMIUM_BOOST ?? 0.08);
const EVENT_UPCOMING_BOOST = Number(process.env.EVENT_UP_BOOST ?? 0.3);
const EVENT_PAST_PENALTY = Number(process.env.EVENT_PAST_PEN ?? -0.75);

// Default: próximos primero, aleatorio dentro; puedes cambiar a "random"
const EVT_DEFAULT_ORDER = (
  process.env.EVT_DEFAULT_ORDER || "random_upfirst"
).toLowerCase();

// 🧠 Limpia links vacíos
const cleanLink = (val) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

// 👇 Helpers Cloudinary (NUEVOS)
const isCloudinaryUrl = (url) =>
  typeof url === "string" && /res\.cloudinary\.com/.test(url);

const getCloudinaryPublicId = (url) => {
  try {
    const u = new URL(url);
    // .../upload/v12345/<carpeta>/<nombre>.ext
    const parts = u.pathname.split("/");
    const filename = parts[parts.length - 1]; // nombre.ext
    const idxUpload = parts.findIndex((p) => p === "upload");
    if (idxUpload === -1) return null;
    // después de 'upload' viene 'vNNNN', luego carpetas reales y al final filename
    const after = parts.slice(idxUpload + 2, parts.length - 1); // carpetas
    const nameNoExt = filename.replace(/\.[^/.]+$/, "");
    return [...after, nameNoExt].join("/"); // carpeta/subcarpeta/nombre
  } catch {
    return null;
  }
};

// 🛠 Campos actualizables
const camposActualizables = [
  "title",
  "description",
  "date",
  "time",
  "location",
  "featuredImage",
  "images",
  "tags",
  "language",
  "price",
  "isFree",
  "registrationLink",
  "isOnline",
  "virtualLink",
  "communities",
  "businesses",
  "categories",
  "sponsors",
  "featured",
  "isPublished",
  "status",
];

// ✅ Crear evento (versión unificada y robusta)
export const createEvent = async (req, res) => {
  try {
    const payload =
      typeof req.body?.data === "string"
        ? JSON.parse(req.body.data)
        : { ...req.body };

    let {
      title,
      description,
      date,
      time,
      location,
      communities = [],
      businesses = [],
      categories = [],
      featuredImage,
      images = [],
      tags = [],
      language = "es",
      price = 0,
      isFree = true,
      registrationLink,
      isOnline = false,
      virtualLink,
      sponsors = [],
      featured = false,
      isPublished = false,
      status = "activo",
      organizer,
      organizerModel,
    } = payload;

    if (organizer && typeof organizer !== "string") {
      if (typeof organizer?.toString === "function") {
        organizer = organizer.toString();
      } else {
        organizer = String(organizer);
      }
    }

    const toStringArray = (arr) =>
      Array.isArray(arr) ? arr.map((x) => String(x)) : [];
    communities = toStringArray(communities);
    businesses = toStringArray(businesses);
    categories = toStringArray(categories);
    sponsors = toStringArray(sponsors);
    tags = Array.isArray(tags) ? tags.map(String) : [];

    const realOrganizer =
      req.user?.role === "admin" && organizer ? organizer : String(req.user.id);

    const realModel =
      req.user?.role === "admin" && organizerModel
        ? organizerModel
        : req.user?.role === "business_owner"
        ? "Business"
        : "User";

    const clean = (val) =>
      typeof val === "string" && val.trim() === "" ? undefined : val;

    registrationLink = clean(registrationLink);
    virtualLink = clean(virtualLink);

    let enrichedLocation = location;
    let geoCoordinates = undefined;

    if (isOnline) {
      if (communities.length > 0) {
        for (const communityId of communities) {
          const community = await Community.findById(communityId);
          if (
            community?.coordinates?.coordinates &&
            Array.isArray(community.coordinates.coordinates) &&
            community.coordinates.coordinates.length === 2 &&
            typeof community.coordinates.coordinates[0] === "number" &&
            typeof community.coordinates.coordinates[1] === "number"
          ) {
            geoCoordinates = {
              type: "Point",
              coordinates: community.coordinates.coordinates,
            };
            break;
          }
        }
      }

      if (!geoCoordinates) {
        geoCoordinates = {
          type: "Point",
          coordinates: [-96.797, 32.7767], // Dallas, TX
        };
      }

      enrichedLocation = {
        address: "",
        city: "",
        state: "",
        zipCode: "",
        country: (location && location.country) || "USA",
      };
    } else {
      if (location?.address && location?.city && location?.state) {
        const fullAddress = `${location.address}, ${location.city}, ${
          location.state
        }, ${location.country || "USA"}`;

        const coords = await geocodeAddress(fullAddress);
        if (
          !coords ||
          typeof coords.lat !== "number" ||
          typeof coords.lng !== "number"
        ) {
          return res
            .status(400)
            .json({ msg: "Error al obtener coordenadas de la dirección." });
        }

        enrichedLocation = { ...location };
        if (enrichedLocation.coordinates) delete enrichedLocation.coordinates;

        geoCoordinates = {
          type: "Point",
          coordinates: [coords.lng, coords.lat],
        };
      } else {
        enrichedLocation = { ...(location || {}) };
        if (enrichedLocation.coordinates) delete enrichedLocation.coordinates;
      }
    }

    const eventData = {
      title,
      description,
      date,
      time,
      location: enrichedLocation,
      communities,
      businesses,
      categories,
      featuredImage,
      images,
      tags,
      language,
      price,
      isFree,
      isOnline,
      registrationLink,
      virtualLink,
      sponsors,
      featured,
      isPublished,
      status,
      organizer: realOrganizer,
      organizerModel: realModel,
      createdBy: req.user.id,
    };

    if (
      geoCoordinates?.type === "Point" &&
      Array.isArray(geoCoordinates.coordinates) &&
      geoCoordinates.coordinates.length === 2 &&
      typeof geoCoordinates.coordinates[0] === "number" &&
      typeof geoCoordinates.coordinates[1] === "number"
    ) {
      eventData.coordinates = geoCoordinates;
    }

    const newEvent = new Event(eventData);

    if (req.user.isPremium === true) {
      newEvent.isPremium = true;
    }

    await newEvent.save();

    if (businesses.length) {
      const followers = await Follow.find({
        entityType: "business",
        entityId: { $in: businesses },
      });

      if (followers.length) {
        const notifications = followers.map((f) => ({
          user: f.user,
          message: `Un negocio que sigues publicó un nuevo evento: "${title}".`,
          link: `/eventos/${newEvent._id}`,
        }));
        await Notification.insertMany(notifications);
      }
    }

    return res
      .status(201)
      .json({ msg: "Evento creado exitosamente", event: newEvent });
  } catch (error) {
    console.error("❌ Error en createEvent:", error);
    return res
      .status(500)
      .json({ msg: "Error al crear el evento", error: error.message });
  }
};

export const getAllEvents = async (req, res) => {
  try {
    // 🔒 Anti-cache
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const { lat, lng, page = 1, limit = 15, order, debug } = req.query;
    const pg = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(parseInt(limit, 10) || 15, 100);
    const skip = (pg - 1) * lim;

    const PREMIUM_BOOST = Number(process.env.PREMIUM_BOOST ?? 0.08);
    const EVENT_UPCOMING_BOOST = Number(process.env.EVENT_UP_BOOST ?? 0.3);
    const EVENT_PAST_PENALTY = Number(process.env.EVENT_PAST_PEN ?? -0.75);
    const EVT_DEFAULT_ORDER = (
      process.env.EVT_DEFAULT_ORDER || "random_upfirst"
    ).toLowerCase();

    const mode = String(order || EVT_DEFAULT_ORDER).toLowerCase();
    const radiusInMiles = 80;
    const radiusInRadians = radiusInMiles / 3963.2;

    const match = {};
    if (lat && lng) {
      match["coordinates"] = {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusInRadians],
        },
      };
    }

    console.log("[getAllEvents]", {
      mode,
      page: pg,
      limit: lim,
      hasLatLng: Boolean(lat && lng),
      time: new Date().toISOString(),
    });

    const total = await Event.countDocuments(match);
    const now = new Date();

    // A) Mezcla suave (bonus a próximos; penaliza pasados)
    if (mode === "random") {
      const items = await Event.aggregate([
        { $match: match },
        {
          $addFields: {
            _startAt: {
              $cond: [
                { $eq: [{ $type: "$date" }, "date"] },
                "$date",
                {
                  $dateFromString: {
                    dateString: "$date",
                    onError: null,
                    onNull: null,
                  },
                },
              ],
            },
          },
        },
        {
          $addFields: {
            _isUpcoming: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$_startAt", null] },
                    { $gte: ["$_startAt", now] },
                  ],
                },
                true,
                false,
              ],
            },
          },
        },
        {
          $addFields: {
            ...(debug === "1"
              ? { _r1: { $rand: {} }, _r2: { $rand: {} } }
              : {}),
            _score: {
              $add: [
                { $rand: {} },
                { $divide: [{ $rand: {} }, 2] },
                { $cond: ["$isPremium", PREMIUM_BOOST, 0] },
                {
                  $cond: [
                    "$_isUpcoming",
                    EVENT_UPCOMING_BOOST,
                    EVENT_PAST_PENALTY,
                  ],
                },
              ],
            },
          },
        },
        // 👇 project válido (solo si hay debug; si no, lo omitimos)
        ...(debug === "1"
          ? [
              {
                $project: {
                  _r1: 1,
                  _r2: 1,
                  _score: 1,
                  title: 1,
                  date: 1,
                  isPremium: 1,
                },
              },
            ]
          : []),
        { $sort: { _score: -1, _id: 1 } },
        { $skip: skip },
        { $limit: lim },
      ]);

      const events = await Event.populate(items, [
        { path: "communities", select: "name" },
        { path: "businesses", select: "name" },
        { path: "categories", select: "name" },
        { path: "organizer", select: "name email" },
        { path: "sponsors", select: "name" },
        { path: "createdBy", select: "name" },
      ]);

      return res.status(200).json({
        events,
        total,
        perPage: lim,
        page: pg,
        totalPages: Math.ceil(total / lim),
      });
    }

    // B) DEFAULT: Próximos SIEMPRE primero; dentro de cada grupo, aleatorio + boost premium
    if (mode === "random_upfirst") {
      const items = await Event.aggregate([
        { $match: match },
        {
          $addFields: {
            _startAt: {
              $cond: [
                { $eq: [{ $type: "$date" }, "date"] },
                "$date",
                {
                  $dateFromString: {
                    dateString: "$date",
                    onError: null,
                    onNull: null,
                  },
                },
              ],
            },
          },
        },
        // 0 = próximos (o sin fecha); 1 = pasados
        {
          $addFields: {
            _group: {
              $cond: [
                {
                  $or: [
                    { $eq: ["$_startAt", null] },
                    { $gte: ["$_startAt", now] },
                  ],
                },
                0,
                1,
              ],
            },
          },
        },
        {
          $addFields: {
            ...(debug === "1"
              ? { _r1: { $rand: {} }, _r2: { $rand: {} } }
              : {}),
            _score: {
              $add: [
                { $rand: {} },
                { $divide: [{ $rand: {} }, 2] },
                { $cond: ["$isPremium", PREMIUM_BOOST, 0] },
              ],
            },
          },
        },
        // ❌ Nada de $project vacío. Si quieres ver debug, proyecta campos explícitos:
        ...(debug === "1"
          ? [
              {
                $project: {
                  _group: 1,
                  _score: 1,
                  _r1: 1,
                  _r2: 1,
                  title: 1,
                  date: 1,
                  isPremium: 1,
                },
              },
            ]
          : []),
        { $sort: { _group: 1, _score: -1, _id: 1 } },
        { $skip: skip },
        { $limit: lim },
      ]);

      const events = await Event.populate(items, [
        { path: "communities", select: "name" },
        { path: "businesses", select: "name" },
        { path: "categories", select: "name" },
        { path: "organizer", select: "name email" },
        { path: "sponsors", select: "name" },
        { path: "createdBy", select: "name" },
      ]);

      return res.status(200).json({
        events,
        total,
        perPage: lim,
        page: pg,
        totalPages: Math.ceil(total / lim),
      });
    }

    // 🧭 Camino normal (sin aleatorio)
    const events = await Event.find(match)
      .populate("communities", "name")
      .populate("businesses", "name")
      .populate("categories", "name")
      .populate("organizer", "name email")
      .populate("sponsors", "name")
      .populate("createdBy", "name")
      .skip(skip)
      .limit(lim);

    res.status(200).json({
      events,
      total,
      perPage: lim,
      page: pg,
      totalPages: Math.ceil(total / lim),
    });
  } catch (error) {
    console.error("❌ Error en getAllEvents:", error);
    res.status(500).json({ msg: "Error al obtener los eventos" });
  }
};

// ✅ Obtener evento por ID
export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("communities", "name")
      .populate("businesses", "name")
      .populate("categories", "name")
      .populate("organizer", "name email")
      .populate("sponsors", "name")
      .populate("createdBy", "name");

    if (!event) return res.status(404).json({ msg: "Evento no encontrado" });

    await EventView.create({
      event: event._id,
      viewer: req.user ? req.user._id : null,
      isAnonymous: !req.user,
      viewedAt: new Date(),
    });

    res.status(200).json({ event });
  } catch (error) {
    console.error("❌ Error en getEventById:", error);
    res.status(500).json({ msg: "Error al obtener el evento" });
  }
};

// ✅ Actualizar evento (galería mixta, tope 5, borrados cloudinary)
export const updateEvent = async (req, res) => {
  // 🔎 Logs útiles
  console.log("🧩 BODY KEYS:", Object.keys(req.body || {}));
  console.log("🧩 FILES KEYS:", Object.keys(req.files || {}));
  console.log("🧪 req.body.featuredImage:", req.body.featuredImage);
  console.log(
    "🧪 req.body.images count:",
    Array.isArray(req.body.images) ? req.body.images.length : 0
  );
  console.log(
    "raw req.body.data:",
    typeof req.body.data,
    typeof req.body.data === "string" ? req.body.data.slice(0, 200) : ""
  );

  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Evento no encontrado" });

    const esOrganizador = event.organizer.toString() === req.user.id;
    const esAdmin = req.user.role === "admin";
    if (!esOrganizador && !esAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para editar este evento" });
    }

    // 1) Unificar payload si viene en `data`
    const payload =
      typeof req.body?.data === "string"
        ? JSON.parse(req.body.data)
        : req.body || {};

    // Extraer campos que afectan geocodificación
    const {
      location: payloadLocation,
      isOnline: payloadIsOnline,
      registrationLink: payloadRegistrationLink,
      virtualLink: payloadVirtualLink,
      businesses: payloadBusinesses,
      existingImages: existingImagesFromData, // 👈 viene del front (UI)
      featuredImage: featuredImageFromData,
      images: _ignoredImagesInData, // no usamos esto del data, las nuevas URLs llegan en req.body.images desde tu middleware
    } = payload;

    // 2) Geocodificación si es presencial y hay dirección
    const location =
      typeof payloadLocation === "object" ? payloadLocation : undefined;
    const isOnline =
      typeof payloadIsOnline === "boolean" ? payloadIsOnline : event.isOnline;

    if (
      location &&
      typeof location === "object" &&
      !isOnline &&
      location.address &&
      location.city &&
      location.state
    ) {
      try {
        const fullAddress = `${location.address}, ${location.city}, ${
          location.state
        }, ${location.country || "USA"}`;
        const coords = await geocodeAddress(fullAddress);

        // Guardamos como objeto simple (tu modelo lo transforma a geoJSON si corresponde)
        req.body.location = { ...location, coordinates: coords };
        req.body.coordinates = coords;
      } catch (err) {
        console.error("❌ Error al geocodificar:", err);
        return res
          .status(400)
          .json({ msg: "Dirección inválida o sin resultados." });
      }
    }

    // 3) Limpiar campos vacíos
    if (payloadRegistrationLink === "") req.body.registrationLink = undefined;
    if (payloadVirtualLink === "") req.body.virtualLink = undefined;

    // 4) ====== IMÁGENES ======
    const prevFeatured = event.featuredImage;
    const prevGallery = Array.isArray(event.images) ? event.images : [];

    // Featured: prioriza lo que subió el middleware como file; si no, lo que llegue en `data`
    let nextFeatured = prevFeatured;
    if (
      typeof req.body.featuredImage === "string" &&
      req.body.featuredImage.trim()
    ) {
      nextFeatured = req.body.featuredImage.trim();
    } else if (
      typeof featuredImageFromData === "string" &&
      featuredImageFromData.trim()
    ) {
      nextFeatured = featuredImageFromData.trim();
    }

    // existingImages puede venir en data o legacy arriba
    const rawExistingTop = req.body.existingImages; // legacy por compatibilidad
    const existingProvided =
      Object.prototype.hasOwnProperty.call(payload, "existingImages") ||
      Object.prototype.hasOwnProperty.call(req.body, "existingImages");

    let existingImages;
    try {
      existingImages =
        typeof existingImagesFromData === "string"
          ? JSON.parse(existingImagesFromData)
          : existingImagesFromData ??
            (typeof rawExistingTop === "string"
              ? JSON.parse(rawExistingTop)
              : rawExistingTop);
    } catch {
      existingImages = undefined;
    }

    // Nuevas URLs subidas en esta request (las pone tu middleware en req.body.images)
    const newUrls = Array.isArray(req.body.images) ? req.body.images : [];

    console.log("existingProvided:", existingProvided);
    console.log("prevGallery:", prevGallery.length, prevGallery);
    console.log(
      "keepInput (existingImages):",
      Array.isArray(existingImages) ? existingImages.length : "(undefined)",
      existingImages
    );
    console.log("newUrls (subidas):", newUrls.length, newUrls);

    const MAX_GALLERY = 5;

    // Si existingImages vino (aunque sea []), lo usamos como set final del usuario;
    // Si NO vino, interpretamos que no quiso tocar la galería → conservamos prevGallery y SOLO agregamos nuevas hasta el tope.
    const keepInput = Array.isArray(existingImages)
      ? existingImages
      : prevGallery;

    // normaliza keep (únicas, orden conservado)
    const seen = new Set();
    const keep = [];
    for (const u of keepInput) {
      if (typeof u === "string" && u && !seen.has(u)) {
        seen.add(u);
        keep.push(u);
      }
    }

    // cupos y overflow para nuevas
    const slots = Math.max(0, MAX_GALLERY - keep.length);
    const acceptedNew = newUrls.slice(0, slots);
    const overflowNew = newUrls.slice(slots);

    const nextGallery = [...keep, ...acceptedNew];
    console.log("nextGallery:", nextGallery.length, nextGallery);
    console.log("overflowNew:", overflowNew.length);

    // 5) Aplicar cambios (excepto imágenes que ya fijamos arriba)
    for (const campo of camposActualizables) {
      if (campo === "images" || campo === "featuredImage") continue; // las manejamos aparte
      if (payload[campo] !== undefined) {
        event[campo] = payload[campo];
      } else if (req.body[campo] !== undefined) {
        event[campo] = req.body[campo];
      }
    }

    // featured/profile y galería
    if (typeof nextFeatured === "string") event.featuredImage = nextFeatured;
    event.images = nextGallery;

    await event.save();

    // 6) Borrados Cloudinary (best-effort)
    const uploadedByFile = req._uploadedByFile || {};
    const uploadedPublicIds = req._uploadedPublicIds || { gallery: [] };

    // Featured: si cambió y la nueva vino por file → borra la anterior
    if (
      nextFeatured !== prevFeatured &&
      uploadedByFile.featuredImage &&
      prevFeatured &&
      isCloudinaryUrl(prevFeatured)
    ) {
      const pid = getCloudinaryPublicId(prevFeatured);
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

    // Galería: si existingImages vino → borra las que el usuario quitó (prev - keep)
    if (Array.isArray(existingImages)) {
      const removedOld = prevGallery.filter((url) => !keep.includes(url));
      const removedOldPids = removedOld
        .filter(isCloudinaryUrl)
        .map(getCloudinaryPublicId)
        .filter(Boolean);
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
    }

    // Overflow: nuevas subidas que no entraron por el tope
    if (
      Array.isArray(uploadedPublicIds.gallery) &&
      uploadedPublicIds.gallery.length
    ) {
      const overflowPids = uploadedPublicIds.gallery
        .filter((it) => overflowNew.includes(it.url))
        .map((it) => it.public_id)
        .filter(Boolean);

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

    // 7) Notificaciones por negocios
    const businesses = Array.isArray(payloadBusinesses)
      ? payloadBusinesses
      : req.body.businesses;
    if (businesses?.length) {
      const followers = await Follow.find({
        entityType: "business",
        entityId: { $in: businesses },
      });

      if (followers.length) {
        const notifications = followers.map((f) => ({
          user: f.user,
          actionType: "event_updated",
          entityType: "event",
          entityId: event._id,
          message: `Un negocio que sigues actualizó un evento: "${event.title}".`,
          link: `/eventos/${event._id}`,
          read: false,
        }));

        await Notification.insertMany(notifications);
      }
    }

    res.status(200).json({ msg: "Evento actualizado correctamente", event });
  } catch (error) {
    console.error("❌ Error en updateEvent:", error);
    res.status(500).json({ msg: "Error al actualizar el evento" });
  }
};

// ✅ Eliminar evento
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Evento no encontrado" });

    const esOrganizador = event.organizer.toString() === req.user.id;
    const esAdmin = req.user.role === "admin";
    if (!esOrganizador && !esAdmin) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para eliminar este evento" });
    }

    await event.deleteOne();
    res.status(200).json({ msg: "Evento eliminado exitosamente" });
  } catch (error) {
    console.error("❌ Error en deleteEvent:", error);
    res.status(500).json({ msg: "Error al eliminar el evento" });
  }
};

// ✅ Obtener eventos del usuario autenticado
export const getMyEventsController = async (req, res) => {
  try {
    const events = await Event.find({
      organizer: req.user.id,
      organizerModel: req.user.role === "business_owner" ? "Business" : "User",
    })
      .populate("communities", "name")
      .populate("categories", "name")
      .populate("businesses", "name")
      .populate("sponsors", "name");

    res.status(200).json({ events });
  } catch (error) {
    console.error("❌ Error en getMyEventsController:", error);
    res.status(500).json({ msg: "Error al obtener tus eventos" });
  }
};

// ✅ Toggle Like
export const toggleLikeEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Evento no encontrado" });

    const userId = req.user._id.toString();
    const index = event.likes.findIndex((id) => id.toString() === userId);

    if (index === -1) {
      event.likes.push(userId);
    } else {
      event.likes.splice(index, 1);
    }

    await event.save();

    res.json({
      likesCount: event.likes.length,
      liked: index === -1,
    });
  } catch (error) {
    console.error("❌ Error en toggleLikeEvent:", error);
    res.status(500).json({ error: "Error al procesar el me gusta" });
  }
};

// ✅ Resumen del evento (seguidores, comentarios, ratings)
export const getEventSummary = async (req, res) => {
  const { id } = req.params;

  try {
    const followersCount = await Follow.countDocuments({
      entityType: "event",
      entity: id,
    });

    const commentsCount = await Comment.countDocuments({
      entityType: "event",
      entity: id,
    });

    const ratingsAggregation = await Rating.aggregate([
      {
        $match: {
          entityType: "event",
          entity: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $group: {
          _id: "$value",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const ratingsAll = await Rating.find({
      entityType: "event",
      entity: id,
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
    console.error("❌ Error en getEventSummary:", error);
    res.status(500).json({ msg: "Error al obtener el resumen del evento" });
  }
};
