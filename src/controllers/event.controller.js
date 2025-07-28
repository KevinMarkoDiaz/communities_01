import mongoose from "mongoose";
import Event from "../models/event.model.js";
import Business from "../models/business.model.js";
import Notification from "../models/Notification.model.js";
import Follow from "../models/follow.model.js";
import { geocodeAddress } from "../utils/geocode.js";
import EventView from "../models/eventView.model.js";
import Rating from "../models/rating.model.js";
import Comment from "../models/comment.model.js";

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
export const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      date,
      time,
      location,
      coordinates,
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
    } = req.body;

    const realOrganizer = req.user.role === "admin" ? organizer : req.user.id;
    const realModel =
      req.user.role === "admin"
        ? organizerModel
        : req.user.role === "business_owner"
        ? "Business"
        : "User";

    // 🗺 Geocodificar si es evento presencial
    let enrichedLocation = location;
    let geoCoordinates;

    if (!isOnline && location?.address && location?.city && location?.state) {
      const fullAddress = `${location.address}, ${location.city}, ${
        location.state
      }, ${location.country || "USA"}`;
      const coords = await geocodeAddress(fullAddress); // [lat, lng]

      enrichedLocation = { ...location, coordinates: coords };

      // ✅ Guardar como GeoJSON ordenado
      geoCoordinates = {
        type: "Point",
        coordinates: [coords[1], coords[0]], // [lng, lat]
      };
    }

    const newEvent = new Event({
      title,
      description,
      date,
      time,
      location: enrichedLocation,
      coordinates: geoCoordinates,
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
      registrationLink: cleanLink(registrationLink),
      virtualLink: cleanLink(virtualLink),
      sponsors,
      featured,
      isPublished,
      status,
      organizer: realOrganizer,
      organizerModel: realModel,
      createdBy: req.user.id,
    });

    await newEvent.save();

    // 🔔 Notificar seguidores
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
        console.log(
          `📢 Notificaciones creadas para ${followers.length} seguidores.`
        );
      }
    }

    res
      .status(201)
      .json({ msg: "Evento creado exitosamente", event: newEvent });
  } catch (error) {
    console.error("❌ Error en createEvent:", error);
    res
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
