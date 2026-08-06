const FILE_TYPE = Object.freeze({
  IMAGE: Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),

  PDF: Object.freeze([
    "application/pdf",
  ]),

  TEST_UPLOAD: Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]),
});

export default FILE_TYPE;