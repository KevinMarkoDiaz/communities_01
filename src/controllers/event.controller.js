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
// 🧠 Limpia links vacíos
const cleanLink = (val) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

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

// ✅ Crear evento
// ✅ Crear evento (versión unificada y robusta)
export const createEvent = async (req, res) => {
  try {
    // 1) Unificar payload (multipart con FormData trae un campo 'data' stringificado)
    const payload =
      typeof req.body?.data === "string"
        ? JSON.parse(req.body.data)
        : { ...req.body };

    // 2) Extraer campos (con defaults)
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

    // 3) Normalizar organizer a string (evita ObjectId top-level)
    if (organizer && typeof organizer !== "string") {
      if (typeof organizer?.toString === "function") {
        organizer = organizer.toString();
      } else {
        organizer = String(organizer);
      }
    }

    // 4) Quilatar arrays de IDs → string[]
    const toStringArray = (arr) =>
      Array.isArray(arr) ? arr.map((x) => String(x)) : [];
    communities = toStringArray(communities);
    businesses = toStringArray(businesses);
    categories = toStringArray(categories);
    sponsors = toStringArray(sponsors);
    tags = Array.isArray(tags) ? tags.map(String) : [];
    // likes normalmente no lo envías en creación; si llega, lo ignoramos

    // 5) Resolver organizer real según rol
    const realOrganizer =
      req.user?.role === "admin" && organizer ? organizer : String(req.user.id);

    const realModel =
      req.user?.role === "admin" && organizerModel
        ? organizerModel // "User" | "Business" (confiamos en tu UI/admin)
        : req.user?.role === "business_owner"
        ? "Business"
        : "User";

    // 6) Limpieza de links ("" -> undefined)
    const clean = (val) =>
      typeof val === "string" && val.trim() === "" ? undefined : val;

    registrationLink = clean(registrationLink);
    virtualLink = clean(virtualLink);

    // 7) Geocodificación / coordinates (GeoJSON)
    let enrichedLocation = location;
    let geoCoordinates = undefined;

    if (isOnline) {
      // 🌐 ONLINE: intentar usar coordinates de alguna comunidad; si no, fallback a Dallas
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

      // Limpia dirección física si vino con datos residuales
      enrichedLocation = {
        address: "",
        city: "",
        state: "",
        zipCode: "",
        country: (location && location.country) || "USA",
      };
    } else {
      // 📍 PRESENCIAL: geocodificar si hay dirección suficiente
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
        // por si llega un objeto location.coordinates {lat, lng}, lo removemos
        if (enrichedLocation.coordinates) delete enrichedLocation.coordinates;

        geoCoordinates = {
          type: "Point",
          coordinates: [coords.lng, coords.lat],
        };
      } else {
        // Dirección incompleta → no incluimos coordinates; el índice 2dsphere no fallará si no existe
        enrichedLocation = { ...(location || {}) };
        if (enrichedLocation.coordinates) delete enrichedLocation.coordinates;
      }
    }

    // 8) Construir documento final del evento
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

    // Adjuntar GeoJSON solo si es válido
    if (
      geoCoordinates?.type === "Point" &&
      Array.isArray(geoCoordinates.coordinates) &&
      geoCoordinates.coordinates.length === 2 &&
      typeof geoCoordinates.coordinates[0] === "number" &&
      typeof geoCoordinates.coordinates[1] === "number"
    ) {
      eventData.coordinates = geoCoordinates;
    }

    // 9) Crear y guardar
    const newEvent = new Event(eventData);

    // Premium flag si aplica
    if (req.user.isPremium === true) {
      newEvent.isPremium = true;
    }

    await newEvent.save();

    // 🔔 Notificar seguidores de negocios mencionados
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
    const { lat, lng, page = 1, limit = 15 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const parsedLimit = parseInt(limit);

    let query = {};
    const radiusInMiles = 80;
    const radiusInRadians = radiusInMiles / 3963.2;

    if (lat && lng) {
      query["coordinates"] = {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], radiusInRadians],
        },
      };
    }

    const total = await Event.countDocuments(query);
    const events = await Event.find(query)
      .populate("communities", "name")
      .populate("businesses", "name")
      .populate("categories", "name")
      .populate("organizer", "name email")
      .populate("sponsors", "name")
      .populate("createdBy", "name")
      .skip(skip)
      .limit(parsedLimit);

    res.status(200).json({
      events,
      total,
      perPage: parsedLimit,
      page: parseInt(page),
      totalPages: Math.ceil(total / parsedLimit),
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

// ✅ Actualizar evento
export const updateEvent = async (req, res) => {
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

    const {
      location,
      isOnline,
      registrationLink,
      virtualLink,
      businesses = [],
    } = req.body;

    // 📍 Geocodificación si es presencial y hay dirección
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

        req.body.location.coordinates = coords;
        req.body.coordinates = coords; // Guardamos como propiedad de primer nivel para búsquedas geográficas
      } catch (err) {
        console.error("❌ Error al geocodificar:", err);
        return res
          .status(400)
          .json({ msg: "Dirección inválida o sin resultados." });
      }
    }

    // 🧼 Limpiar campos vacíos
    if (registrationLink === "") req.body.registrationLink = undefined;
    if (virtualLink === "") req.body.virtualLink = undefined;

    // ✅ Aplicar cambios
    for (const campo of camposActualizables) {
      if (req.body[campo] !== undefined) {
        event[campo] = req.body[campo];
      }
    }

    await event.save();

    // 🔔 Notificar seguidores si el negocio cambia
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
