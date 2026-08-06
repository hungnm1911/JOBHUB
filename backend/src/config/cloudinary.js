import { v2 as cloudinary } from "cloudinary";

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

    console.log("Connected to Cloudinary successfully.");
  } catch (error) {
    console.error(
      "Failed to connect to Cloudinary:",
      error.message,
    );

    throw error;
  }
};

export { verifyCloudinaryConnection };

export default cloudinary;