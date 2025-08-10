import mongoose from "mongoose";
import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import Business from "../models/business.model.js";
import Event from "../models/event.model.js";
import Notification from "../models/Notification.model.js";
import User from "../models/user.model.js";
import EmailThrottle from "../models/EmailThrottle.js";
import { sendNewMessageEmail } from "../services/email.service.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Obtener todos los mensajes de una conversación
 */
export const getMessagesByConversation = async (req, res) => {
  const { conversationId } = req.params;

  if (!isValidObjectId(conversationId)) {
    return res.status(400).json({ message: "ID de conversación inválido" });
  }

  try {
    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "name role profileImage")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    res.status(500).json({ message: "Error interno al obtener mensajes" });
  }
};

/**
 * Enviar un mensaje en una conversación
 */
export const sendMessage = async (req, res) => {
  const { conversationId, text } = req.body;

  if (!isValidObjectId(conversationId)) {
    return res.status(400).json({ message: "ID de conversación inválido" });
  }

  if (!text || text.trim() === "") {
    return res.status(400).json({ message: "El mensaje no puede estar vacío" });
  }

  try {
    // Buscar conversación sin populate primero
    let conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: "Conversación no encontrada" });
    }

    // Populate dinámico
    const entityModel =
      conversation.entityType === "business" ? "Business" : "Event";

    conversation = await Conversation.findById(conversationId)
      .populate("user")
      .populate({
        path: "entityId",
        model: entityModel,
      });

    // Crear el mensaje
    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      text,
      isRead: false,
    });

    // Actualizar la conversación
    conversation.lastMessage = text;
    conversation.lastMessageAt = new Date();
    conversation.lastMessageIsRead = false;
    await conversation.save();

    await message.populate("sender", "name role profileImage");

    // Determinar receptor de la notificación
    let recipientUserId;
    let entityId;
    let entityTypeForNotification;

    const senderId = req.user._id.toString();
    const userIdInConversation = conversation.user?._id?.toString();

    if (senderId === userIdInConversation) {
      // Sender es el usuario normal
      if (conversation.entityType === "business") {
        const business = await Business.findById(
          conversation.entityId?._id
        ).populate("owner");
        recipientUserId = business?.owner?._id;
        entityId = business?._id;
        entityTypeForNotification = "business";
      } else if (conversation.entityType === "event") {
        const event = await Event.findById(conversation.entityId?._id).populate(
          "createdBy"
        );
        recipientUserId = event?.createdBy?._id;
        entityId = event?._id;
        entityTypeForNotification = "event";
      }
    } else {
      // Sender es el dueño (business owner o creador del evento)
      recipientUserId = conversation.user?._id;
      entityId = conversation.user?._id;
      entityTypeForNotification = "message";
    }

    // Crear notificación si hay receptor
    if (recipientUserId) {
      await Notification.create({
        user: recipientUserId,
        entityType: entityTypeForNotification,
        entityId: entityId,
        actionType: "message_received",
        message: `Has recibido un nuevo mensaje de ${message.sender.name}`,
        link: `/inbox/conversation/${conversationId}`,
      });
    }
    try {
      if (recipientUserId) {
        // Cargar usuario destinatario
        const recipientUser = await User.findById(recipientUserId).select(
          "name email isPremium notifications"
        );
        // (opcional) si en el futuro agregas preferencias: notifications.emailMessages === false => no enviar
        const emailEnabled =
          recipientUser?.notifications?.emailMessages !== false;

        if (recipientUser?.isPremium && recipientUser?.email && emailEnabled) {
          const windowMinutes = Number(process.env.EMAIL_THROTTLE_MINUTES || 5);
          const canSend = await EmailThrottle.canSend(
            recipientUser._id,
            conversationId,
            windowMinutes
          );

          if (canSend) {
            await sendNewMessageEmail({
              to: recipientUser.email,
              recipientName: recipientUser.name,
              senderName: message.sender?.name || "Alguien",
              preview: text,
              conversationId,
            });
            await EmailThrottle.markSent(recipientUser._id, conversationId);
          }
        }
      }
    } catch (e) {
      // No rompas el flujo si el email falla
      console.error("Error enviando email de nuevo mensaje:", e.message);
    }
    res.status(201).json(message);
  } catch (error) {
    console.error("Error en sendMessage:", error);
    res.status(500).json({ message: "Error interno al enviar mensaje" });
  }
};

/**
 * Marcar un mensaje como leído
 */
export const markMessageAsRead = async (req, res) => {
  const { messageId } = req.params;

  if (!isValidObjectId(messageId)) {
    return res.status(400).json({ message: "ID de mensaje inválido" });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Mensaje no encontrado" });
    }

    message.isRead = true;
    await message.save();

    const conversation = await Conversation.findById(message.conversation);
    if (conversation) {
      conversation.lastMessageIsRead = true;
      await conversation.save();
    }

    res.status(200).json({ message: "Mensaje marcado como leído" });
  } catch (error) {
    console.error("Error al marcar mensaje como leído:", error);
    res.status(500).json({ message: "Error interno al marcar como leído" });
  }
};
