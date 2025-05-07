import { validationResult } from "express-validator";
import Event from "../models/event.model.js";
import Community from "../models/community.model.js";
import Business from "../models/business.model.js";
import Category from "../models/category.model.js";

export const createEvent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    title,
    description,
    date,
    location,
    communities = [],
    businesses = [],
    categories = [],
    image
  } = req.body;

  try {
    const newEvent = new Event({
      title,
      description,
      date,
      location,
      communities,
      businesses,
      categories,
      image,
      organizer: req.user.id,
      organizerModel: req.user.role === "business_owner" ? "Business" : "User"
    });

    await newEvent.save();

    res.status(201).json({ msg: "Evento creado exitosamente", event: newEvent });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al crear el evento" });
  }
};

export const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find()
      .populate("communities")
      .populate("businesses")
      .populate("categories")
      .populate("organizer");
    res.status(200).json({ events });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener los eventos" });
  }
};

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("communities")
      .populate("businesses")
      .populate("categories")
      .populate("organizer");
    if (!event) return res.status(404).json({ msg: "Evento no encontrado" });
    res.status(200).json({ event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al obtener el evento" });
  }
};

export const updateEvent = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    title,
    description,
    date,
    location,
    image,
    communities,
    businesses,
    categories
  } = req.body;

  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Evento no encontrado" });

    if (event.organizer.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ msg: "No tienes permisos para editar este evento" });
    }

    event.title = title || event.title;
    event.description = description || event.description;
    event.date = date || event.date;
    event.location = location || event.location;
    event.image = image || event.image;
    event.communities = communities || event.communities;
    event.businesses = businesses || event.businesses;
    event.categories = categories || event.categories;

    await event.save();

    res.status(200).json({ msg: "Evento actualizado", event });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al actualizar el evento" });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Evento no encontrado" });

    if (event.organizer.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ msg: "No tienes permisos para eliminar este evento" });
    }

    await event.deleteOne();
    res.status(200).json({ msg: "Evento eliminado exitosamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Error al eliminar el evento" });
  }
};
