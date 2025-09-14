export function needsPrerender(req) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const isBot =
    /googlebot|bingbot|baiduspider|yandex|twitterbot|facebookexternalhit|linkedinbot/.test(
      ua
    );
  const isStaticAsset = /\.(js|css|png|jpe?g|svg|gif|webp|ico|json|map)$/i.test(
    req.path
  );
  return isBot && !isStaticAsset;
}

export async function prerenderMiddleware(req, res, next) {
  if (!needsPrerender(req)) return next();

  try {
    // ⚡ Si usas un servicio de prerender (ej. prerender.io)
    // const html = await fetch(`https://service-prerender.com/render?url=${encodeURIComponent('https://communidades.com' + req.originalUrl)}`).then(r=>r.text());
    // res.set("Content-Type", "text/html; charset=utf-8").send(html);

    // de momento, sigue al next
    next();
  } catch (err) {
    console.error("❌ Error prerender:", err);
    next();
  }
}
