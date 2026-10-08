import express from "express";

import { listExperienceLevelsHandler } from "../controllers/experience-level.controller.js";

const router = express.Router();

router.get("/", listExperienceLevelsHandler);

export default router;
