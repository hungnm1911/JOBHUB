import { v2 as cloudinary } from "cloudinary";

import logger from "../utils/logger.js";
import config from "./index.js";

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

const verifyCloudinaryConnection = async () => {
  try {
    await cloudinary.api.ping();

    logger.info("Connected to Cloudinary successfully.");
  } catch (error) {
    logger.error("Failed to connect to Cloudinary", { error });

    throw error;
  }
};

export { verifyCloudinaryConnection };

export default cloudinary;