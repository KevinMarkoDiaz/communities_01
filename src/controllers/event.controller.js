import mongoose from "mongoose";
import Event from "../models/event.model.js";
import Business from "../models/business.model.js";
import Notification from "../models/Notification.model.js";
import Follow from "../models/follow.model.js";
import { geocodeAddress } from "../utils/geocode.js";
import eventViewModel from "../models/eventView.model.js";
import Rating from "../models/rating.model.js";
import Comment from "../models/comment.model.js";
// Crear un nuevo evento
export const createEvent = async (req, res) => {
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

  try {
    const realOrganizer = req.user.role === "admin" ? organizer : req.user.id;
    const realModel =
      req.user.role === "admin"
        ? organizerModel
        : req.user.role === "business_owner"
        ? "Business"
        : "User";

    const cleanLink = (val) =>
      typeof val === "string" && val.trim() === "" ? undefined : val;

    const cleanedRegistrationLink = cleanLink(registrationLink);
    const cleanedVirtualLink = cleanLink(virtualLink);

    let enrichedLocation = location;
    if (!isOnline && location?.address && location?.city && location?.state) {
      const fullAddress = `${location.address}, ${location.city}, ${
        location.state
      }, ${location.country || "USA"}`;
      const coords = await geocodeAddress(fullAddress);
      enrichedLocation = {
        ...location,
        coordinates: coords,
      };
    }

    const newEvent = new Event({
      title,
      description,
      date,
      time,
      location: enrichedLocation,
      coordinates,
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
      registrationLink: cleanedRegistrationLink,
      virtualLink: cleanedVirtualLink,
      sponsors,
      featured,
      isPublished,
      status,
      organizer: realOrganizer,
      organizerModel: realModel,
      createdBy: req.user.id,
    });

    await newEvent.save();

    // Notificar seguidores de los negocios relacionados
    if (businesses?.length) {
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
    console.error(error);
    res.status(500).json({ msg: "Error al crear el evento" });
  }
};

// Obtener todos los eventos
export const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("communities", "name")
      .populate("businesses", "name")
      .populate("categories", "name")
      .populate("organizer", "name email")
      .populate("sponsors", "name")
      .populate("createdBy", "name");

    res.status(200).json({ events });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener los eventos" });
  }
};

// Obtener evento por ID
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

    console.log("✅ Event encontrado:", JSON.stringify(event, null, 2));

    await eventViewModel.create({
      event: event._id,
      viewer: req.user ? req.user._id : null,
      isAnonymous: !req.user,
      viewedAt: new Date(),
    });

    res.status(200).json({ event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener el evento" });
  }
};

// Actualizar evento
export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Evento no encontrado" });

    if (
      event.organizer.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para editar este evento" });
    }

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

    if (
      req.body.location &&
      typeof req.body.location === "object" &&
      !req.body.isOnline
    ) {
      try {
        const fullAddress = `${req.body.location.address}, ${
          req.body.location.city
        }, ${req.body.location.state}, ${req.body.location.country || "USA"}`;
        const coords = await geocodeAddress(fullAddress);
        req.body.location.coordinates = coords;
      } catch (err) {
        console.error("❌ Error al obtener coordenadas:", err);
        return res
          .status(400)
          .json({ msg: "Dirección inválida o sin coordenadas." });
      }
    }

    ["registrationLink", "virtualLink"].forEach((campo) => {
      if (
        typeof req.body[campo] === "string" &&
        req.body[campo].trim() === ""
      ) {
        req.body[campo] = undefined;
      }
    });

    for (const campo of camposActualizables) {
      if (req.body[campo] !== undefined) {
        event[campo] = req.body[campo];
      }
    }

    await event.save();

    // Notificar seguidores de los negocios relacionados
    if (event.businesses?.length) {
      const followers = await Follow.find({
        entityType: "business",
        entityId: { $in: event.businesses },
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
        console.log(
          `📢 Notificaciones creadas para ${followers.length} seguidores.`
        );
      }
    }

    res.status(200).json({ msg: "Evento actualizado", event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al actualizar el evento" });
  }
};

// Eliminar evento
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Evento no encontrado" });

    if (
      event.organizer.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ msg: "No tienes permisos para eliminar este evento" });
    }

    await event.deleteOne();
    res.status(200).json({ msg: "Evento eliminado exitosamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar el evento" });
  }
};

// Obtener eventos del usuario autenticado
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error al obtener tus eventos" });
  }
};

// ✅ Alternar like
export const toggleLikeEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

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
    console.error("Error al togglear like:", error);
    res.status(500).json({ error: "Error al procesar el me gusta" });
  }
};

export const getEventSummary = async (req, res) => {
  const { id } = req.params;

  try {
    // 1️⃣ Total de seguidores
    const followersCount = await Follow.countDocuments({
      entityType: "event",
      entity: id,
    });

    // 2️⃣ Total de comentarios
    const commentsCount = await Comment.countDocuments({
      entityType: "event",
      entity: id,
    });

    // 3️⃣ Agrupación de ratings por cantidad de estrellas
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
      {
        $sort: { _id: 1 },
      },
    ]);

    // 4️⃣ Promedio de rating
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
