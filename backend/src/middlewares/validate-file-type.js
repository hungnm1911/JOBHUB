import { fileTypeFromBuffer } from "file-type";

import AppError from "../utils/app-error.js";

const validateFileType = (allowedMimeTypes) => {
  return async (request, response, next) => {
    try {
      // Việc bắt buộc phải có file sẽ do controller xử lý.
      if (!request.file) {
        next();

        return;
      }

      const detectedFileType = await fileTypeFromBuffer(
        request.file.buffer,
      );

      if (!detectedFileType) {
        next(
          new AppError(
            415,
            "Unable to determine the uploaded file type",
          ),
        );

        return;
      }

      if (!allowedMimeTypes.includes(detectedFileType.mime)) {
        next(
          new AppError(
            415,
            `Unsupported file type: ${detectedFileType.mime}`,
          ),
        );

        return;
      }

      request.file.detectedMimeType =
        detectedFileType.mime;

      request.file.detectedExtension =
        detectedFileType.ext;

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default validateFileType;