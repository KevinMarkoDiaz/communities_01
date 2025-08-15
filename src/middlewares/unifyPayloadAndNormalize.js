// middlewares/unifyPayloadAndNormalize.js
function toStringArray(arr) {
  return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
}

export function unifyPayloadAndNormalize(req, _res, next) {
  try {
    // 1) Si viene multipart con 'data' como JSON string, fusiónalo al body
    if (typeof req.body?.data === "string") {
      const parsed = JSON.parse(req.body.data);
      req.body = { ...req.body, ...parsed };
      delete req.body.data;
    }

    // 2) organizer: forzar a string si viene como ObjectId/objeto
    if (req.body.organizer && typeof req.body.organizer !== "string") {
      if (typeof req.body.organizer.toString === "function") {
        req.body.organizer = req.body.organizer.toString();
      } else {
        req.body.organizer = String(req.body.organizer);
      }
    }

    // 3) Normalizar arrays de IDs a string[]
    req.body.categories = toStringArray(req.body.categories);
    req.body.communities = toStringArray(req.body.communities);
    req.body.sponsors = toStringArray(req.body.sponsors);
    req.body.businesses = toStringArray(req.body.businesses);
    req.body.likes = toStringArray(req.body.likes);

    // 4) Limpiar links vacíos
    const clean = (v) =>
      typeof v === "string" && v.trim() === "" ? undefined : v;
    req.body.registrationLink = clean(req.body.registrationLink);
    req.body.virtualLink = clean(req.body.virtualLink);

    next();
  } catch (e) {
    next(e);
  }
}
