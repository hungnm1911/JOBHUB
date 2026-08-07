import express from "express";

import config from "../config/index.js";

import authAccessProbeRouter from "./auth-access-probe.routes.js";
import authRouter from "./auth.routes.js";
import fileRouter from "./file.routes.js";
import helloWorldRoutes from "./hello-world.routes.js";
import platformAdminRouter from "./platform-admin.routes.js";

const router = express.Router();

router.use("/", helloWorldRoutes);
router.use("/auth", authRouter);
router.use("/platform-admin", platformAdminRouter);

if (config.env !== "production") {
  router.use("/files", fileRouter);
  router.use("/auth-access-probe", authAccessProbeRouter);
}

export default router;