import express from "express";

import {
  listDistrictLevelUnitsHandler,
  listProvincesHandler,
} from "../controllers/location.controller.js";

const router = express.Router();

router.get("/provinces", listProvincesHandler);
router.get(
  "/provinces/:provinceCode/district-level-units",
  listDistrictLevelUnitsHandler,
);

export default router;
