export const validateBody = (schema) => (req, res, next) => {
  const reqId = req.id || "-";
  const ct = req.headers["content-type"] || "-";
  const clen = req.headers["content-length"] || "-";
  const method = req.method;
  const url = req.originalUrl || req.url || "-";

  // Log inicial del request/body crudo
  try {
    const rawKeys = Object.keys(req.body || {});
    const hasData = typeof req.body?.data === "string";
    const dataLen = hasData ? String(req.body.data.length) : "0";
    const dataPreview = hasData
      ? req.body.data.slice(0, 200).replace(/\s+/g, " ")
      : "";
    console.log(
      `[validateBody] id=${reqId} ${method} ${url} ct=${ct} clen=${clen} ` +
        `keys=${JSON.stringify(
          rawKeys
        )} hasData=${hasData} dataLen=${dataLen} ` +
        (hasData ? `dataPreview="${dataPreview}"` : "")
    );
  } catch {}

  try {
    let inputData;

    if (typeof req.body.data === "string") {
      // Si viene de FormData, parsear
      const parsedData = JSON.parse(req.body.data);
      inputData = {
        ...parsedData,
        icon: req.body.profileImage, // ya subido a Cloudinary
      };

      // Log tras parsear "data"
      try {
        const keys = Object.keys(inputData || {});
        const types = Object.fromEntries(
          Object.entries(inputData || {}).map(([k, v]) => [
            k,
            Array.isArray(v) ? "array" : v === null ? "null" : typeof v,
          ])
        );
        const coords = inputData?.mapCenter?.coordinates;
        console.log(
          `[validateBody] id=${reqId} parsedFromData keys=${JSON.stringify(
            keys
          )} ` +
            `types=${JSON.stringify(types)} coords=${
              Array.isArray(coords) ? "[" + coords.join(",") + "]" : "n/a"
            }`
        );
      } catch {}
    } else {
      // Si viene como JSON normal
      inputData = req.body;

      // Log del body JSON directo
      try {
        const keys = Object.keys(inputData || {});
        const types = Object.fromEntries(
          Object.entries(inputData || {}).map(([k, v]) => [
            k,
            Array.isArray(v) ? "array" : v === null ? "null" : typeof v,
          ])
        );
        const coords = inputData?.mapCenter?.coordinates;
        console.log(
          `[validateBody] id=${reqId} parsedFromJSON keys=${JSON.stringify(
            keys
          )} ` +
            `types=${JSON.stringify(types)} coords=${
              Array.isArray(coords) ? "[" + coords.join(",") + "]" : "n/a"
            }`
        );
      } catch {}
    }

    const validated = schema.parse(inputData);

    // Log de validación OK
    try {
      const vKeys = Object.keys(validated || {});
      const coords = validated?.mapCenter?.coordinates;
      console.log(
        `[zod] id=${reqId} OK keys=${JSON.stringify(vKeys)} ` +
          `coords=${
            Array.isArray(coords) ? "[" + coords.join(",") + "]" : "n/a"
          }`
      );
    } catch {}

    req.body = validated; // reemplazamos req.body por la versión validada
    next();
  } catch (err) {
    // Logs detallados del fallo
    if (err?.name === "ZodError") {
      const issues = err.errors?.map((i) => ({
        path: Array.isArray(i.path) ? i.path.join(".") : String(i.path),
        message: i.message,
        code: i.code,
        expected: i.expected,
        received: i.received,
      }));
      console.warn(`[zod] id=${reqId} FAIL issues=${JSON.stringify(issues)}`);
    } else if (err instanceof SyntaxError) {
      console.warn(
        `[validateBody] id=${reqId} JSON.parse FAIL: ${err.message}`
      );
    } else {
      console.warn(`[validateBody] id=${reqId} FAIL: ${err?.message || err}`);
    }

    console.error("❌ Error en validateBody:", err.errors);
    return res
      .status(400)
      .json({ msg: "Error de validación", errors: err.errors });
  }
};
