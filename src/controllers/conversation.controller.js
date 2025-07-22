import Conversation from "../models/conversation.model.js";
import Business from "../models/business.model.js";
import Event from "../models/event.model.js";
import Message from "../models/message.model.js";
import mongoose from "mongoose";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Crea o recupera una conversación entre un usuario y una entidad (negocio o evento).
 */
export const createOrGetConversation = async (req, res) => {
  const { entityType, entityId } = req.body;

  if (!entityType || !entityId) {
    return res
      .status(400)
      .json({ message: "entityType y entityId son requeridos." });
  }

  if (!["business", "event"].includes(entityType)) {
    return res
      .status(400)
      .json({ message: "entityType inválido. Debe ser 'business' o 'event'." });
  }

  if (!isValidObjectId(entityId)) {
    return res.status(400).json({ message: "ID de entidad no válido." });
  }

  try {
    let entityModel = entityType === "business" ? Business : Event;
    const entity = await entityModel.findById(entityId);

    if (!entity) {
      return res
        .status(404)
        .json({
          message: `${
            entityType === "business" ? "Negocio" : "Evento"
          } no encontrado.`,
        });
    }

    // Validación: evitar que el usuario hable consigo mismo
    const ownerId =
      entityType === "business"
        ? entity.owner?.toString()
        : entity.createdBy?.toString();
    if (ownerId === req.user._id.toString()) {
      return res
        .status(400)
        .json({ message: "No puedes iniciar conversación contigo mismo." });
    }

    let conversation = await Conversation.findOne({
      user: req.user._id,
      entityType,
      entityId,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        user: req.user._id,
        entityType,
        entityId,
      });
    }

    const populated = await Conversation.findById(conversation._id)
      .populate("user", "name email profileImage")
      .populate({
        path: "entityId",
        model: entityType === "business" ? "Business" : "Event",
        select: entityType === "business" ? "name" : "title",
      });

    res.status(200).json(populated);
  } catch (error) {
    console.error("❌ Error en createOrGetConversation:", error);
    res
      .status(500)
      .json({ message: "Error al crear o recuperar la conversación." });
  }
};

/**
 * Obtiene todas las conversaciones relacionadas con el usuario autenticado.
 */
export const getMyConversations = async (req, res) => {
  try {
    let conversations = [];

    if (["business_owner", "admin"].includes(req.user.role)) {
      const [myBusinesses, myEvents] = await Promise.all([
        Business.find({ owner: req.user._id }).select("_id"),
        Event.find({ createdBy: req.user._id }).select("_id"),
      ]);

      const businessIds = myBusinesses.map((b) => b._id);
      const eventIds = myEvents.map((e) => e._id);

      const [businessConvs, eventConvs] = await Promise.all([
        Conversation.find({
          entityType: "business",
          entityId: { $in: businessIds },
        })
          .populate("user", "name")
          .populate({ path: "entityId", model: "Business", select: "name" }),
        Conversation.find({ entityType: "event", entityId: { $in: eventIds } })
          .populate("user", "name")
          .populate({ path: "entityId", model: "Event", select: "title" }),
      ]);

      conversations = businessConvs.concat(eventConvs);
    } else {
      const [businessConvs, eventConvs] = await Promise.all([
        Conversation.find({ user: req.user._id, entityType: "business" })
          .populate("user", "name")
          .populate({ path: "entityId", model: "Business", select: "name" }),
        Conversation.find({ user: req.user._id, entityType: "event" })
          .populate("user", "name")
          .populate({ path: "entityId", model: "Event", select: "title" }),
      ]);

      conversations = businessConvs.concat(eventConvs);
    }

    // Ordenar por fecha de actualización
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Enriquecer con último mensaje y mensajes no leídos
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const [lastMsg, unreadCount] = await Promise.all([
          Message.findOne({ conversation: conv._id })
            .sort({ createdAt: -1 })
            .lean(),
          Message.countDocuments({
            conversation: conv._id,
            sender: { $ne: req.user._id },
            isRead: false,
          }),
        ]);

        return {
          ...conv.toObject(),
          lastMessageSender: lastMsg?.sender?.toString() || null,
          lastMessageRead: lastMsg?.isRead ?? false,
          unreadCount,
        };
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error("❌ Error en getMyConversations:", error);
    res.status(500).json({ message: "Error al obtener conversaciones." });
  }
};
