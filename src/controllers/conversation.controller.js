import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Business from "../models/business.model.js";
import Event from "../models/event.model.js";
import Message from "../models/message.model.js";

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
    const entityModel = entityType === "business" ? Business : Event;
    const entity = await entityModel.findById(entityId);

    if (!entity) {
      return res.status(404).json({
        message: `${
          entityType === "business" ? "Negocio" : "Evento"
        } no encontrado.`,
      });
    }

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
        select: entityType === "business" ? "name logo" : "title featuredImage",
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
    const userId = req.user._id;
    let conversations = [];

    let businessIds = [];
    let eventIds = [];

    if (["business_owner", "admin"].includes(req.user.role)) {
      const [myBusinesses, myEvents] = await Promise.all([
        Business.find({ owner: userId }).select("_id"),
        Event.find({ createdBy: userId }).select("_id"),
      ]);

      businessIds = myBusinesses.map((b) => b._id);
      eventIds = myEvents.map((e) => e._id);

      const [businessConvs, eventConvs] = await Promise.all([
        Conversation.find({
          entityType: "business",
          entityId: { $in: businessIds },
        })
          .populate("user", "name profileImage")
          .populate({
            path: "entityId",
            model: "Business",
            select: "name logo",
          }),

        Conversation.find({
          entityType: "event",
          entityId: { $in: eventIds },
        })
          .populate("user", "name profileImage")
          .populate({
            path: "entityId",
            model: "Event",
            select: "title featuredImage",
          }),
      ]);

      const mensajesEnviados = await Message.find({ sender: userId }).select(
        "conversation"
      );
      const convIds = [
        ...new Set(mensajesEnviados.map((m) => m.conversation.toString())),
      ];

      const [sentConversations, sentEventConvs] = await Promise.all([
        Conversation.find({
          _id: { $in: convIds },
          entityType: "business",
        })
          .populate("user", "name profileImage")
          .populate({
            path: "entityId",
            model: "Business",
            select: "name logo",
          }),

        Conversation.find({
          _id: { $in: convIds },
          entityType: "event",
        })
          .populate("user", "name profileImage")
          .populate({
            path: "entityId",
            model: "Event",
            select: "title featuredImage",
          }),
      ]);

      const todas = [
        ...businessConvs,
        ...eventConvs,
        ...sentConversations,
        ...sentEventConvs,
      ];

      // Eliminar duplicados por _id
      const mapaUnico = new Map();
      todas.forEach((c) => {
        if (c?.entityId) {
          mapaUnico.set(c._id.toString(), c);
        }
      });

      conversations = Array.from(mapaUnico.values());
    } else {
      const [businessConvs, eventConvs] = await Promise.all([
        Conversation.find({ user: userId, entityType: "business" })
          .populate("user", "name profileImage")
          .populate({
            path: "entityId",
            model: "Business",
            select: "name logo",
          }),

        Conversation.find({ user: userId, entityType: "event" })
          .populate("user", "name profileImage")
          .populate({
            path: "entityId",
            model: "Event",
            select: "title featuredImage",
          }),
      ]);

      conversations = [...businessConvs, ...eventConvs].filter(
        (c) => c.entityId
      );
    }

    // Ordenar por última actualización
    conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // Enriquecer con mensaje más reciente y conteo de no leídos
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const [lastMsg, unreadCount] = await Promise.all([
          Message.findOne({ conversation: conv._id })
            .sort({ createdAt: -1 })
            .lean(),
          Message.countDocuments({
            conversation: conv._id,
            sender: { $ne: userId },
            isRead: false,
          }),
        ]);

        const entity = conv.entityId;
        const isBusiness = conv.entityType === "business";

        return {
          _id: conv._id,
          name: isBusiness ? entity?.name : entity?.title,
          image: isBusiness ? entity?.logo : entity?.featuredImage,
          tipo: conv.entityType,
          lastMessage: lastMsg?.text || "",
          lastMessageIsRead: lastMsg?.isRead ?? false,
          lastMessageSender: lastMsg?.sender?.toString() || null,
          unreadCount,
          entityId: entity?._id?.toString() || conv.entityId,
          user: conv.user,
        };
      })
    );

    res.status(200).json(enriched);
  } catch (error) {
    console.error("❌ Error en getMyConversations:", error);
    res.status(500).json({ message: "Error al obtener conversaciones." });
  }
};
