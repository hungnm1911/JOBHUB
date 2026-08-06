import express from "express";

import {
  deleteTestFile,
  uploadTestFile,
} from "../controllers/file.controller.js";

import FILE_TYPE from "../constants/file-type.js";

import fileUpload from "../middlewares/file-upload.js";

import validateFileType from "../middlewares/validate-file-type.js";

const router = express.Router();

/*-----ROUTE TEST----- */
router.post(
  "/test-upload",
  fileUpload.single("file"),
  validateFileType(FILE_TYPE.TEST_UPLOAD),
  uploadTestFile,
);

router.delete(
  "/test-delete",
  deleteTestFile,
);

export default router;