// middlewares/parseCommunityData.js
export function parseCommunityData(req, res, next) {
  try {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    const reqId = req.id || "-";

    // Seguridad: nunca aceptar estos campos del cliente (los fija el backend)
    if (req.body && typeof req.body === "object") {
      delete req.body.owner;
      delete req.body.status; // crear siempre será "Publicada" en el controller
      delete req.body.verified; // el controller fija false (o tu lógica)
    }

    // 1) Si el front envía un sobre "data" (JSON.stringify), úsalo primero
    if (typeof req.body?.data === "string") {
      try {
        const parsed = JSON.parse(req.body.data);
        delete req.body.data;

        // merge NO destructivo (no pisar archivos de multer)
        for (const [k, v] of Object.entries(parsed)) {
          if (v === undefined || v === null || v === "") continue;
          if (
            req.body[k] === undefined ||
            req.body[k] === "" ||
            req.body[k] === null
          ) {
            req.body[k] = v;
          }
        }
      } catch (e) {
        console.warn(
          `[parseCommunityData] id=${reqId} JSON inválido en "data": ${e.message}`
        );
        return res
          .status(400)
          .json({ msg: 'Error al parsear "data" como JSON' });
      }
    }

    // 2) Si es multipart, castear SOLO campos esperados de Comunidades
    if (ct.startsWith("multipart/form-data")) {
      const out = {};
      const jsonLike = new Set([
        "mapCenter",
        "location",
        "externalLinks",
        "resources",
        "originCountryInfo",
        "food",
        "traditions",
        "socialMediaLinks",
      ]);
      for (const [k, v] of Object.entries(req.body || {})) {
        if (typeof v !== "string") {
          out[k] = v;
          continue;
        }
        const t = v.trim();

        if (
          jsonLike.has(k) &&
          ((t.startsWith("{") && t.endsWith("}")) ||
            (t.startsWith("[") && t.endsWith("]")))
        ) {
          try {
            out[k] = JSON.parse(t);
            continue;
          } catch {}
        }

        // booleans solo si fueran relevantes (en create igual se ignoran)
        if (k === "isVerified" && (t === "true" || t === "false")) {
          out[k] = t === "true";
          continue;
        }

        out[k] = v; // deja string por defecto
      }
      req.body = out;
    }

    // 3) Normaliza coordenadas: mapCenter.coordinates → números
    const toNum = (n) => (typeof n === "string" ? Number(n) : n);
    if (Array.isArray(req.body?.mapCenter?.coordinates)) {
      req.body.mapCenter.coordinates =
        req.body.mapCenter.coordinates.map(toNum);
    }

    // 4) Si mapCenter es inválido, intenta reconstruir desde location
    const coords = req.body?.mapCenter?.coordinates;
    const coordsInvalid =
      !Array.isArray(coords) ||
      coords.length !== 2 ||
      coords.some((n) => !Number.isFinite(n));

    if (coordsInvalid && req.body?.location) {
      const loc = req.body.location || {};
      const lng = toNum(
        loc.lng ?? loc.longitude ?? loc.lon ?? loc.coordinates?.[0]
      );
      const lat = toNum(loc.lat ?? loc.latitude ?? loc.coordinates?.[1]);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        req.body.mapCenter = { type: "Point", coordinates: [lng, lat] };
        console.log(
          `[parseCommunityData] id=${reqId} mapCenter <- location [${lng},${lat}]`
        );
      }
    }

    // 5) Log compacto (solo para comunidades)
    const types = Object.fromEntries(
      Object.entries(req.body || {}).map(([k, v]) => [
        k,
        Array.isArray(v) ? "array" : v === null ? "null" : typeof v,
      ])
    );
    const finalCoords = req.body?.mapCenter?.coordinates;
    console.log(
      `[community:body] id=${reqId} keys=${JSON.stringify(
        Object.keys(req.body || {})
      )} ` +
        `types=${JSON.stringify(types)} coords=${
          Array.isArray(finalCoords) ? "[" + finalCoords.join(",") + "]" : "n/a"
        }`
    );

    next();
  } catch (err) {
    console.error(
      `[parseCommunityData] id=${req.id || "-"} error: ${err.message}`
    );
    return res
      .status(400)
      .json({ msg: "Error al procesar datos de comunidad" });
  }
}
