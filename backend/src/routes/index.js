import express from "express";

import config from "../config/index.js";

import fileRouter from "./file.routes.js";
import helloWorldRoutes from "./hello-world.routes.js";

const router = express.Router();

router.use("/", helloWorldRoutes);

if (config.env !== "production") {
  router.use("/files", fileRouter);
}

export default router;