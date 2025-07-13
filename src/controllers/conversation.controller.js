import Conversation from "../models/conversation.model.js";
import Business from "../models/business.model.js";
import Event from "../models/event.model.js";
import Message from "../models/message.model.js";

/**
 * Crear o recuperar una conversación entre un usuario y un negocio o un evento.
 */
export const createOrGetConversation = async (req, res) => {
  const { entityType, entityId } = req.body;

  if (!entityType || !entityId) {
    return res
      .status(400)
      .json({ message: "entityType y entityId son requeridos" });
  }

  if (!["business", "event"].includes(entityType)) {
    return res.status(400).json({ message: "entityType inválido" });
  }

  try {
    // Verificar que la entidad existe
    let entity;
    if (entityType === "business") {
      entity = await Business.findById(entityId);
      if (!entity) {
        return res.status(404).json({ message: "Negocio no encontrado" });
      }

      // Validar que el usuario no sea el dueño del negocio
      if (entity.owner.toString() === req.user._id.toString()) {
        return res
          .status(400)
          .json({ message: "No puedes iniciar conversación contigo mismo" });
      }
    } else if (entityType === "event") {
      entity = await Event.findById(entityId);
      if (!entity) {
        return res.status(404).json({ message: "Evento no encontrado" });
      }
      // Si quieres, aquí podrías validar si el usuario es el creador del evento
      // if (entity.creator.toString() === req.user._id.toString()) { ... }
    }

    // Buscar si ya existe la conversación
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

    // Populate dinámico (corrigiendo el nombre del modelo)
    conversation = await Conversation.findById(conversation._id)
      .populate("user")
      .populate({
        path: "entityId",
        model: entityType === "business" ? "Business" : "Event",
      });

    res.status(200).json(conversation);
  } catch (error) {
    console.error("❌ Error en createOrGetConversation:", error);
    res.status(500).json({ message: "Error al crear/conseguir conversación" });
  }
};

/**
 * Obtener todas las conversaciones del usuario autenticado.
 */
export const getMyConversations = async (req, res) => {
  try {
    let conversations = [];

    if (req.user.role === "business_owner" || req.user.role === "admin") {
      // Buscar negocios tuyos
      const businesses = await Business.find({ owner: req.user._id }).select(
        "_id"
      );
      const businessIds = businesses.map((b) => b._id);

      // Buscar eventos tuyos
      const events = await Event.find({ createdBy: req.user._id }).select(
        "_id"
      );
      const eventIds = events.map((e) => e._id);

      // Conversaciones con negocios
      const businessConversations = await Conversation.find({
        entityType: "business",
        entityId: { $in: businessIds },
      })
        .populate("user", "name")
        .populate({
          path: "entityId",
          model: "Business",
          select: "name",
        });

      // Conversaciones con eventos
      const eventConversations = await Conversation.find({
        entityType: "event",
        entityId: { $in: eventIds },
      })
        .populate("user", "name")
        .populate({
          path: "entityId",
          model: "Event",
          select: "title",
        });

      conversations = businessConversations.concat(eventConversations);
      conversations.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    } else {
      // Usuario normal
      const businessConversations = await Conversation.find({
        user: req.user._id,
        entityType: "business",
      })
        .populate("user", "name")
        .populate({
          path: "entityId",
          model: "Business",
          select: "name",
        });

      const eventConversations = await Conversation.find({
        user: req.user._id,
        entityType: "event",
      })
        .populate("user", "name")
        .populate({
          path: "entityId",
          model: "Event",
          select: "title",
        });

      conversations = businessConversations.concat(eventConversations);
      conversations.sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    }

    // Añadir info del último mensaje y cantidad no leída
    const enrichedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const lastMsg = await Message.findOne({ conversation: conv._id })
          .sort({ createdAt: -1 })
          .lean();

        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: req.user._id },
          isRead: false,
        });

        return {
          ...conv.toObject(),
          lastMessageSender: lastMsg?.sender?.toString() || null,
          lastMessageRead: lastMsg?.isRead ?? false,
          unreadCount,
        };
      })
    );

    res.status(200).json(enrichedConversations);
  } catch (error) {
    console.error("❌ Error en getMyConversations:", error);
    res.status(500).json({ message: "Error al obtener conversaciones" });
  }
};
