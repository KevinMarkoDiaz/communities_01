// utils/uniqueSlug.js
import slugify from "slugify";
import Community from "../models/community.model.js";

export async function generateUniqueSlug(baseName, excludeId = null) {
  const base = slugify(baseName, { lower: true, strict: true }) || "comunidad";
  const regex = new RegExp(`^${base}(?:-(\\d+))?$`, "i");
  const query = { slug: { $regex: regex } };
  if (excludeId) query._id = { $ne: excludeId };

  const collisions = await Community.find(query).select("slug").lean();
  if (collisions.length === 0) return base;

  const nums = collisions
    .map((c) => {
      const m = c.slug.match(/-(\d+)$/);
      return m ? parseInt(m[1], 10) : 1; // el "base" cuenta como 1
    })
    .sort((a, b) => b - a);

  const next = (nums[0] || 1) + 1;
  return `${base}-${next}`;
}
