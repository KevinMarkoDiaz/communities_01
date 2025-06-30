import mongoose from "mongoose";
import dotenv from "dotenv";
import Business from "../src/models/business.model.js";
import negocios from "./negocios_mock.js";

dotenv.config();

const main = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const nuevosNegocios = negocios.slice(0, 2); // Solo los primeros 2
    let creados = 0;

    for (const mock of nuevosNegocios) {
      try {
        const negocio = new Business(mock);
        await negocio.save();
        creados++;
      } catch (err) {
        console.error(`❌ Error creando "${mock.name}":`, err.message);
      }
    }
  } catch (err) {
    console.error("❌ Error general:", err);
  } finally {
    await mongoose.disconnect();
  }
};

main();
