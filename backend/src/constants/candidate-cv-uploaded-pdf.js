const BYTES_PER_MEGABYTE = 1024 * 1024;

// Product BR-22 exact Uploaded CV PDF limits — independent of global upload config.
const CANDIDATE_CV_UPLOADED_PDF = Object.freeze({
  MAX_SIZE_MB: 10,
  MAX_SIZE_BYTES: 10 * BYTES_PER_MEGABYTE,
  MAX_PAGE_COUNT: 20,
  MIME_TYPE: "application/pdf",
});

export default CANDIDATE_CV_UPLOADED_PDF;
