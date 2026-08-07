import express from "express";

import { getProtectedAccessProbe } from "../controllers/auth-access-probe.controller.js";
import authenticateAccess from "../middlewares/authenticate-access.js";

const router = express.Router();

router.get(
  "/protected",
  authenticateAccess,
  getProtectedAccessProbe,
);

export default router;
