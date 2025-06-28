import Event from "../models/event.model.js";
import User from "../models/user.model.js";
import Business from "../models/business.model.js";
import { geocodeAddress } from "../utils/geocode.js";
// Crear un nuevo evento
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
    organizer, // del body
    organizerModel, // del body
  } = req.body;

  try {
    // Si es admin, respeta lo que llega del formulario
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

    // 🌍 Si no es online, obtener coordenadas a partir de location
    let enrichedLocation = location;
    if (!isOnline && location?.address && location?.city && location?.state) {
      const fullAddress = `${location.address}, ${location.city}, ${
        location.state
      }, ${location.country || "USA"}`;
      const coordinates = await geocodeAddress(fullAddress);
      enrichedLocation = {
        ...location,
        coordinates,
      };
    }

    const newEvent = new Event({
      title,
      description,
      date,
      time,
      location,
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

    // Si viene un nuevo location, geocodificar
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

    // Normalizar campos vacíos
    ["registrationLink", "virtualLink"].forEach((campo) => {
      if (
        typeof req.body[campo] === "string" &&
        req.body[campo].trim() === ""
      ) {
        req.body[campo] = undefined;
      }
    });

    // Aplicar actualización de campos
    for (const campo of camposActualizables) {
      if (req.body[campo] !== undefined) {
        event[campo] = req.body[campo];
      }
    }

    await event.save();

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

// Obtener eventos creados por el usuario autenticado
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
