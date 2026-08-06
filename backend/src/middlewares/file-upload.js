import config from "../config/index.js";
import multer from "multer";


const storage = multer.memoryStorage();

const fileUpload = multer({
  storage,
  limits: {
    fileSize: config.fileUpload.maxFileSizeMB * config.fileUpload.bytesPerMegabyte,
    files: 1,
  },
});

export default fileUpload;