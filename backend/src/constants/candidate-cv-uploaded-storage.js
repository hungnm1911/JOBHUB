/**
 * Candidate-CV domain storage policy for Uploaded PDF artifacts (F05/F06/F08).
 * file.service remains a generic Cloudinary capability; this domain chooses
 * restricted delivery so knowing storageKey alone cannot publicly fetch the PDF.
 */
const CANDIDATE_CV_UPLOADED_STORAGE = Object.freeze({
  RESOURCE_TYPE: "raw",
  // Cloudinary authenticated delivery — not public `upload`.
  DELIVERY_TYPE: "authenticated",
});

export default CANDIDATE_CV_UPLOADED_STORAGE;
