import express from "express";
import helloWorldRoutes from "./hello-world.routes.js";

const router = express.Router();

router.use("/", helloWorldRoutes);

export default router;