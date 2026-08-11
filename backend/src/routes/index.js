import express from "express";

import config from "../config/index.js";

import authAccessProbeRouter from "./auth-access-probe.routes.js";
import authRouter from "./auth.routes.js";
import candidateRouter from "./candidate.routes.js";
import companyRouter from "./company.routes.js";
import companyStaffAccessProbeRouter from "./company-staff-access-probe.routes.js";
import fileRouter from "./file.routes.js";
import helloWorldRoutes from "./hello-world.routes.js";
import jobRouter from "./job.routes.js";
import platformAdminRouter from "./platform-admin.routes.js";
import recruiterRouter from "./recruiter.routes.js";

const router = express.Router();

router.use("/", helloWorldRoutes);
router.use("/auth", authRouter);
router.use("/candidate", candidateRouter);
router.use("/company", companyRouter);
router.use("/company/recruiters", recruiterRouter);
router.use("/jobs", jobRouter);
router.use("/platform-admin", platformAdminRouter);

if (config.env !== "production") {
  router.use("/files", fileRouter);
  router.use("/auth-access-probe", authAccessProbeRouter);
  router.use("/company-staff-access-probe", companyStaffAccessProbeRouter);
}

export default router;