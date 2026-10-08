import express from "express";

import {
  listFieldCategoriesHandler,
  listPositionCategoriesHandler,
} from "../controllers/category.controller.js";

const router = express.Router();

router.get("/fields", listFieldCategoriesHandler);
router.get("/fields/:fieldId/positions", listPositionCategoriesHandler);

export default router;
