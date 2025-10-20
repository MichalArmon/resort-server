// 📁 server/router/treatmentsRoutes.js
import { Router } from "express";
import {
  createTreatment,
  listTreatments,
  getTreatment,
  updateTreatment,
  deleteTreatment,
} from "../controllers/treatmentsController.js";

const router = Router();

// GET /api/v1/treatments?q=&category=&tags=water,relax&intensity=&isActive=true&minPrice=&maxPrice=&page=1&limit=20&sort=-createdAt
router.get("/", listTreatments);

// GET by id or slug
router.get("/:idOrSlug", getTreatment);

// CREATE
router.post("/", createTreatment);

// UPDATE by id
router.put("/:id", updateTreatment);

// DELETE by id
router.delete("/:id", deleteTreatment);

export default router;
