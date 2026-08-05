import { Router } from "express";

import { getHelloWorld } from "../controllers/hello-world.controller.js";

const router = Router();

router.get("/", getHelloWorld);

export default router;