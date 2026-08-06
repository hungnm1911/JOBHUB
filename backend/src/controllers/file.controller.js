import CLOUDINARY_FOLDER from "../constants/cloudinary-folder.js";
import {
  deleteFile,
  uploadFileBuffer,
} from "../services/file.service.js";


/*-----FILE NÀY ĐỂ TEST CLOUDINARY----- */
const uploadTestFile = async (
  request,
  response,
  next,
) => {
  try {
    if (!request.file) {
      return response.status(400).json({
        error: {
          message: "File is required",
        },
      });
    }

    const uploadedFile = await uploadFileBuffer({
      buffer: request.file.buffer,
      assetFolder: CLOUDINARY_FOLDER.TEST,
      resourceType: "auto",
    });

    return response.status(201).json({
      message: "File uploaded successfully",
      file: {
        ...uploadedFile,
        originalName: request.file.originalname,
        detectedMimeType:
          request.file.detectedMimeType,
        detectedExtension:
          request.file.detectedExtension,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteTestFile = async (
  request,
  response,
  next,
) => {
  try {
    const {
      publicId,
      resourceType = "image",
      deliveryType = "upload",
    } = request.body ?? {};

    if (
      typeof publicId !== "string" ||
      !publicId.trim()
    ) {
      return response.status(400).json({
        error: {
          message: "File public ID is required",
        },
      });
    }

    const deletedFile = await deleteFile({
      publicId,
      resourceType,
      deliveryType,
    });

    if (deletedFile.result === "not found") {
      return response.status(404).json({
        error: {
          message: "File not found",
        },
      });
    }

    return response.status(200).json({
      message: "File deleted successfully",
      file: deletedFile,
    });
  } catch (error) {
    next(error);
  }
};

export {
  deleteTestFile,
  uploadTestFile,
};