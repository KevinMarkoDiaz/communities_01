import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    // Usuario que inició la conversación
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Tipo de entidad relacionada: "business" o "event"
    entityType: {
      type: String,
      enum: ["business", "event"],
      required: true,
    },

    // Referencia dinámica a Business o Event según entityType
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "entityType",
    },

    // Último mensaje de la conversación (opcional)
    lastMessage: {
      type: String,
    },

    // Fecha del último mensaje
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },

    // Indica si el último mensaje fue leído
    lastMessageIsRead: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt y updatedAt automáticos
  }
);

export default mongoose.model("Conversation", conversationSchema);
