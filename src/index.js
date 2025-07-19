// 🛡️ Errores globales
process.on("uncaughtException", (err) => {
  console.error("🔴 Excepción no capturada:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("🔴 Rechazo no manejado:", reason);
});

import dotenv from "dotenv";
dotenv.config(); // 🟢 Cargar variables antes de todo

import app from "./app.js";
import { connectDB } from "./db.js";

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    console.log("🌱 Iniciando conexión a MongoDB...");
    await connectDB();
    console.log("✅ Conexión a MongoDB exitosa.");

    app.listen(PORT, () => {
      console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al conectar con MongoDB:", error);
    process.exit(1); // Finalizar proceso si falla la conexión
  }
})();
