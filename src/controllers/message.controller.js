import Message from "../models/message.model.js";
import Conversation from "../models/conversation.model.js";
import Business from "../models/business.model.js";
import Event from "../models/event.model.js";
import Notification from "../models/Notification.model.js";

/**
 * Obtener todos los mensajes de una conversación
 */
export const getMessagesByConversation = async (req, res) => {
  const { conversationId } = req.params;

  try {
    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "name role profileImage")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener mensajes" });
  }
};

/**
 * Enviar un mensaje en una conversación
 */
export const sendMessage = async (req, res) => {
  const { conversationId, text } = req.body;

  if (!text) {
    return res.status(400).json({ message: "El mensaje no puede estar vacío" });
  }

  try {
    // Cargar la conversación sin populate primero
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
    conversation.lastMessageIsRead = false; // ⬅️ IMPORTANTE: marcar como NO leído
    await conversation.save();

    await message.populate("sender", "name role profileImage");

    // 🟢 Determinar receptor
    let recipientUserId;
    let entityId;
    let entityTypeForNotification;

    if (req.user._id.equals(conversation.user._id)) {
      // El sender es un usuario normal -> receptor es el dueño del negocio o el creador del evento
      if (conversation.entityType === "business") {
        const business = await Business.findById(
          conversation.entityId._id
        ).populate("owner");
        recipientUserId = business.owner._id;
        entityId = business._id;
        entityTypeForNotification = "business";
      } else if (conversation.entityType === "event") {
        const event = await Event.findById(conversation.entityId._id).populate(
          "createdBy"
        );
        recipientUserId = event.createdBy._id;
        entityId = event._id;
        entityTypeForNotification = "event";
      }
    } else {
      // El sender es el dueño -> receptor es el usuario normal
      recipientUserId = conversation.user._id;
      entityId = conversation.user._id;
      entityTypeForNotification = "message";
    }

    // 🟢 Crear notificación
    await Notification.create({
      user: recipientUserId,
      entityType: entityTypeForNotification,
      entityId: entityId,
      actionType: "message_received",
      message: `Has recibido un nuevo mensaje de ${message.sender.name}`,
      link: `/inbox/conversation/${conversationId}`,
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("❌ Error en sendMessage:", error);
    res.status(500).json({ message: "Error al enviar mensaje" });
  }
};

/**
 * Marcar un mensaje como leído
 */
/**
 * Marcar un mensaje como leído
 */
export const markMessageAsRead = async (req, res) => {
  const { messageId } = req.params;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Mensaje no encontrado" });
    }

    message.isRead = true;
    await message.save();

    // ✅ También marcar en la conversación
    const conversation = await Conversation.findById(message.conversation);
    if (conversation) {
      conversation.lastMessageIsRead = true;
      await conversation.save();
    }

    res.status(200).json({ message: "Mensaje marcado como leído" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al marcar como leído" });
  }
};
