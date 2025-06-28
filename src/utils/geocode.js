import dotenv from "dotenv";
dotenv.config();

import axios from "axios";

const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;

export const geocodeAddress = async (fullAddress) => {
  if (!MAPBOX_API_KEY) {
    throw new Error("MAPBOX_API_KEY no está definido en .env");
  }

  const encodedAddress = encodeURIComponent(fullAddress);

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_API_KEY}&limit=1`;

  const response = await axios.get(url);

  if (
    response.data.features &&
    response.data.features.length > 0 &&
    response.data.features[0].center
  ) {
    const [lng, lat] = response.data.features[0].center;
    return { lat, lng };
  } else {
    throw new Error("No se pudo obtener coordenadas para la dirección.");
  }
};
