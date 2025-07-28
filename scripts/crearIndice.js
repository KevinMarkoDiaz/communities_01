// scripts/migrarEventosCoordenadas.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Event from "../src/models/event.model.js";
import Community from "../src/models/community.model.js";

dotenv.config();
await mongoose.connect(process.env.MONGO_URI);
console.log("✅ Conectado a MongoDB");

const eventos = await Event.find();

let migrados = 0;
for (const evento of eventos) {
  if (evento.coordinates?.coordinates?.length === 2) {
    // Ya tiene coordenadas válidas
    continue;
  }

  let nuevaCoordenada = null;

  // Si el evento tiene coordenadas clásicas lat/lng en location
  if (
    evento.location?.coordinates?.lat != null &&
    evento.location?.coordinates?.lng != null
  ) {
    nuevaCoordenada = {
      type: "Point",
      coordinates: [
        evento.location.coordinates.lng,
        evento.location.coordinates.lat,
      ],
    };
  }

  // Si no tiene coordenadas y es online → tomamos de la comunidad
  if (!nuevaCoordenada && evento.isOnline && evento.communities.length > 0) {
    const comunidad = await Community.findById(evento.communities[0]);
    if (comunidad?.mapCenter?.coordinates?.length === 2) {
      nuevaCoordenada = {
        type: "Point",
        coordinates: comunidad.mapCenter.coordinates,
      };
    }
  }

  if (nuevaCoordenada) {
    evento.coordinates = nuevaCoordenada;
    await evento.save();
    console.log(`🔧 Migrado: ${evento.title}`);
    migrados++;
  } else {
    console.warn(`⚠️ No se pudo asignar coordenadas a ${evento.title}`);
  }
}

console.log(`✅ ${migrados} eventos migrados con coordenadas.`);
await mongoose.disconnect();
console.log("🔌 Conexión cerrada.");
