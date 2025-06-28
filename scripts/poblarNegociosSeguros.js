import mongoose from "mongoose";
import dotenv from "dotenv";
import Business from "../src/models/business.model.js";
import negocios from "./negocios_mock.js";

dotenv.config();

const main = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado a MongoDB");

    const nuevosNegocios = negocios.slice(0, 2); // Solo los primeros 2
    let creados = 0;

    for (const mock of nuevosNegocios) {
      try {
        const negocio = new Business(mock);
        await negocio.save();
        console.log(`✅ Negocio creado: ${negocio.name}`);
        creados++;
      } catch (err) {
        console.error(`❌ Error creando "${mock.name}":`, err.message);
      }
    }

    console.log("\n🎯 Resumen:");
    console.log(`✅ Total creados: ${creados}`);
    console.log("🎉 Proceso finalizado");
  } catch (err) {
    console.error("❌ Error general:", err);
  } finally {
    await mongoose.disconnect();
  }
};

main();
