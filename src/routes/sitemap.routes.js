import express from "express";
import Business from "../models/business.model.js";
const router = express.Router();

const SITE = "https://communidades.com";

// util simple
const iso = (d) => new Date(d || Date.now()).toISOString();

// 2.1 sitemap-index
router.get("/sitemap.xml", async (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap>
      <loc>${SITE}/sitemaps/negocios.xml</loc>
      <lastmod>${iso()}</lastmod>
    </sitemap>
    <sitemap>
      <loc>${SITE}/sitemaps/estaticas.xml</loc>
      <lastmod>${iso()}</lastmod>
    </sitemap>
  </sitemapindex>`;
  res.header("Content-Type", "application/xml").send(xml);
});

// 2.2 sitemap de negocios
router.get("/sitemaps/negocios.xml", async (req, res) => {
  const negocios = await Business.find({ isPublished: true })
    .select("slug updatedAt")
    .lean();

  const urls = negocios
    .map(
      (n) => `
    <url>
      <loc>${SITE}/negocios/${n.slug}</loc>
      <lastmod>${iso(n.updatedAt)}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
  </urlset>`;

  res.header("Content-Type", "application/xml").send(xml);
});

// 2.3 sitemap de páginas estáticas (home, comunidades, etc.)
router.get("/sitemaps/estaticas.xml", async (req, res) => {
  const staticUrls = [
    "",
    "comunidades",
    "negocios",
    "eventos",
    "promociones",
    "contacto",
  ]
    .map(
      (p) => `
    <url>
      <loc>${SITE}/${p}</loc>
      <lastmod>${iso()}</lastmod>
      <changefreq>daily</changefreq>
      <priority>${p === "" ? "1.0" : "0.6"}</priority>
    </url>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${staticUrls}
  </urlset>`;

  res.header("Content-Type", "application/xml").send(xml);
});

export default router;
