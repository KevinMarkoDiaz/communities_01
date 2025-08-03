import { Router } from "express";
import { authMiddleware } from "../middlewares/validateToken.js";
import { buscarGlobal } from "../controllers/busqueda.controller.js";
import { buscarOrganizadores } from "../controllers/organizador.controller.js";
import { buscarComunidades } from "../controllers/comunidad.controller.js";

const router = Router();

router.get("/", buscarGlobal);
router.get("/search/organizers", authMiddleware, buscarOrganizadores);
router.get("/search/communities", buscarComunidades);

export default router;
