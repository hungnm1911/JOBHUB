import multer from "multer";

import CANDIDATE_CV_UPLOADED_PDF from "../constants/candidate-cv-uploaded-pdf.js";
import AppError from "../utils/app-error.js";

const storage = multer.memoryStorage();

const candidateCvUploadedMulter = multer({
  storage,
  limits: {
    fileSize: CANDIDATE_CV_UPLOADED_PDF.MAX_SIZE_BYTES,
    files: 1,
  },
});

// Exact 10 MB limit for Uploaded Candidate CV — not global MAX_FILE_SIZE_MB.
const uploadCandidateCvPdf = (request, response, next) => {
  candidateCvUploadedMulter.single("file")(request, response, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(
        new AppError(400, "Uploaded CV PDF must not exceed 10 MB", {
          field: "file",
        }),
      );
    }

    return next(error);
  });
};

export default uploadCandidateCvPdf;
