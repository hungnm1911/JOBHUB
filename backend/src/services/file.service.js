import cloudinary from "../config/cloudinary.js";

const normalizeUploadResult = (
  uploadResult,
  assetFolder,
) => {
  return {
    assetId: uploadResult.asset_id,
    publicId: uploadResult.public_id,
    resourceType: uploadResult.resource_type,
    deliveryType: uploadResult.type,
    format: uploadResult.format,
    bytes: uploadResult.bytes,
    width: uploadResult.width ?? null,
    height: uploadResult.height ?? null,
    secureUrl: uploadResult.secure_url,
    version: uploadResult.version,
    assetFolder:
      uploadResult.asset_folder ?? assetFolder,
  };
};

const uploadFileBuffer = ({
  buffer,
  assetFolder,
  resourceType = "auto",
}) => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("File buffer is required");
  }

  if (
    typeof assetFolder !== "string" ||
    !assetFolder.trim()
  ) {
    throw new TypeError("Cloudinary asset folder is required");
  }

  const normalizedAssetFolder = assetFolder.trim();

  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          asset_folder: normalizedAssetFolder,
          resource_type: resourceType,
        },
        (error, uploadResult) => {
          if (error) {
            reject(error);

            return;
          }

          resolve(
            normalizeUploadResult(
              uploadResult,
              normalizedAssetFolder,
            ),
          );
        },
      );

    uploadStream.end(buffer);
  });
};

const deleteFile = async ({
  publicId,
  resourceType = "image",
  deliveryType = "upload",
}) => {
  if (
    typeof publicId !== "string" ||
    !publicId.trim()
  ) {
    throw new TypeError("File public ID is required");
  }

  const normalizedPublicId = publicId.trim();

  const deleteResult =
    await cloudinary.uploader.destroy(
      normalizedPublicId,
      {
        resource_type: resourceType,
        type: deliveryType,
        invalidate: true,
      },
    );

  return {
    publicId: normalizedPublicId,
    result: deleteResult.result,
  };
};

/**
 * Storage-only byte fetch by Cloudinary public id.
 * Temporary signed delivery URLs are an implementation detail and must not be
 * exposed or persisted as CandidateCV public-access state.
 */
const downloadFileBuffer = async ({
  publicId,
  resourceType = "raw",
  deliveryType = "upload",
}) => {
  if (
    typeof publicId !== "string" ||
    !publicId.trim()
  ) {
    throw new TypeError("File public ID is required");
  }

  const normalizedPublicId = publicId.trim();
  const signedUrl = cloudinary.url(normalizedPublicId, {
    resource_type: resourceType,
    type: deliveryType,
    secure: true,
    sign_url: true,
  });

  const response = await fetch(signedUrl);

  if (!response.ok) {
    const error = new Error(
      `Failed to download stored file (${response.status})`,
    );
    error.statusCode = response.status;
    throw error;
  }

  return Buffer.from(await response.arrayBuffer());
};

export {
  deleteFile,
  downloadFileBuffer,
  uploadFileBuffer,
};