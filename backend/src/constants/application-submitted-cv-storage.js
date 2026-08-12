/**
 * Application submitted CV snapshot PDF storage policy (V9 F03).
 * file.service remains generic; this domain chooses restricted delivery so
 * knowing storageKey alone cannot publicly fetch the snapshot PDF.
 */
const APPLICATION_SUBMITTED_CV_STORAGE = Object.freeze({
  RESOURCE_TYPE: "raw",
  DELIVERY_TYPE: "authenticated",
});

export default APPLICATION_SUBMITTED_CV_STORAGE;
