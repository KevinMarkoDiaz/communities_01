// utils/geocodeZip.js
import axios from "axios";
import ZipCentroid from "../models/zipCentroid.model.js";

const ZIP5 = /^\d{5}$/;

export async function geocodeZipCentroid(zip, country = "US") {
  if (!ZIP5.test(zip)) {
    throw new Error("ZIP inválido (usa 5 dígitos).");
  }

  // 1) Busca en cache
  const existing = await ZipCentroid.findOne({ country, zip });
  if (existing) {
    return {
      lng: existing.centroid.coordinates[0],
      lat: existing.centroid.coordinates[1],
    };
  }

  // 2) Llama a Mapbox (types=postcode)
  const token = process.env.MAPBOX_API_KEY;
  if (!token) throw new Error("Falta MAPBOX_API_KEY");

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${zip}.json?types=postcode&country=${country}&access_token=${token}`;

  const { data } = await axios.get(url, { timeout: 8000 });
  const feature = data?.features?.[0];
  if (!feature || !Array.isArray(feature.center)) {
    throw new Error("No se encontró centroid para el ZIP.");
  }

  const [lng, lat] = feature.center;

  // 3) Persiste en cache
  await ZipCentroid.create({
    country,
    zip,
    centroid: { type: "Point", coordinates: [lng, lat] },
  });

  return { lng, lat };
}
