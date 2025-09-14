// middlewares/communityFinder.js
import mongoose from "mongoose";
import Community from "../models/community.model.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export async function communityFinder(req, res, next) {
  try {
    const { idOrSlug } = req.params;

    let community = null;
    if (isValidObjectId(idOrSlug)) {
      community = await Community.findById(idOrSlug);
    }
    if (!community) {
      community = await Community.findOne({ slug: idOrSlug });
    }
    if (!community) {
      return res.status(404).json({ msg: "Comunidad no encontrada." });
    }

    req.community = community;
    next();
  } catch (err) {
    console.error("communityFinder error:", err);
    res.status(500).json({ msg: "Error al resolver la comunidad." });
  }
}
