export const rawBodyMiddleware = (req, res, next) => {
  if (req.originalUrl === "/api/stripe/webhook") {
    // 🛑 Desactivamos el body parser para esta ruta
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      req.rawBody = data;
      next();
    });
  } else {
    next();
  }
};
