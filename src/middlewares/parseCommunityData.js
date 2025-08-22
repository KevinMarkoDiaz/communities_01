// middlewares/parseCommunityData.js
export function parseCommunityData(req, res, next) {
  try {
    const ct = (req.headers["content-type"] || "").toLowerCase();
    const reqId = req.id || "-";

    // ──────────────────────────────────────────────────────
    // Helpers de normalización
    // ──────────────────────────────────────────────────────
    const isEmptyPrimitive = (v) => v === "" || v === null || v === undefined;

    const cleanEmpty = (obj) => {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        if (isEmptyPrimitive(v)) continue;
        out[k] = v;
      }
      return Object.keys(out).length ? out : undefined;
    };

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
          if (isEmptyPrimitive(v)) continue;
          if (req.body[k] === undefined || isEmptyPrimitive(req.body[k])) {
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

        // Parseo de JSON-like
        if (
          jsonLike.has(k) &&
          ((t.startsWith("{") && t.endsWith("}")) ||
            (t.startsWith("[") && t.endsWith("]")))
        ) {
          try {
            out[k] = JSON.parse(t);
            continue;
          } catch {
            // si falla, deja string
          }
        }

        // booleans ejemplo (no aplican aquí, pero por si acaso)
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
      }
    }

    // ──────────────────────────────────────────────────────
    // 5) Normalizaciones específicas para evitar fallos en Zod
    // ──────────────────────────────────────────────────────

    // socialMediaLinks: quita claves vacías; si queda vacío, elimina el objeto
    if (
      req.body.socialMediaLinks &&
      typeof req.body.socialMediaLinks === "object"
    ) {
      req.body.socialMediaLinks = cleanEmpty(req.body.socialMediaLinks);
      if (!req.body.socialMediaLinks) delete req.body.socialMediaLinks;
    }

    // originCountryInfo.flag: "" -> undefined; limpia objeto si queda vacío
    if (
      req.body.originCountryInfo &&
      typeof req.body.originCountryInfo === "object"
    ) {
      if (req.body.originCountryInfo.flag === "") {
        req.body.originCountryInfo.flag = undefined;
      }
      req.body.originCountryInfo = cleanEmpty(req.body.originCountryInfo);
      if (!req.body.originCountryInfo) delete req.body.originCountryInfo;
    }

    // externalLinks: filtra entradas sin title/url
    if (Array.isArray(req.body.externalLinks)) {
      req.body.externalLinks = req.body.externalLinks.filter(
        (e) => e && e.title?.toString().trim() && e.url?.toString().trim()
      );
      if (req.body.externalLinks.length === 0) delete req.body.externalLinks;
    }

    // resources: (opcional) filtra entradas mal formadas
    if (Array.isArray(req.body.resources)) {
      req.body.resources = req.body.resources.filter(
        (r) => r && r.title?.toString().trim() && r.url?.toString().trim()
      );
      if (req.body.resources.length === 0) delete req.body.resources;
    }

    // food: normaliza strings vacíos a undefined
    if (Array.isArray(req.body.food)) {
      req.body.food = req.body.food.map((f) => ({
        ...f,
        name: f?.name, // no tocar (lo validará Zod si es requerido)
        description: isEmptyPrimitive(f?.description)
          ? undefined
          : f.description,
        image: isEmptyPrimitive(f?.image) ? undefined : f.image,
      }));
      // puedes eliminar items totalmente vacíos si quieres:
      req.body.food = req.body.food.filter(
        (f) => f && (f.name || f.description || f.image)
      );
      if (req.body.food.length === 0) delete req.body.food;
    }

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
