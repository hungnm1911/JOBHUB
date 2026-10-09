import mongoose from "mongoose";

import config from "../config/index.js";
import logger from "../utils/logger.js";

// Compiling a model schedules `Model.init()`, which on connect creates missing
// collections and builds schema indexes unless the connection disables both.
const MODEL_AUTO_INIT_DISABLED_OPTIONS = Object.freeze({
  autoCreate: false,
  autoIndex: false,
});

let areConnectionListenersRegistered = false;
let isDisconnectingIntentionally = false;

const getErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const registerConnectionListeners = () => {
  if (areConnectionListenersRegistered) {
    return;
  }

  mongoose.connection.on("error", (error) => {
    logger.error("MongoDB connection error", { error });
  });

  mongoose.connection.on("disconnected", () => {
    if (isDisconnectingIntentionally) {
      logger.info("MongoDB disconnected safely.");

      return;
    }

    logger.warn("MongoDB connection was lost.");
  });

  mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected successfully.");
  });

  areConnectionListenersRegistered = true;
};

const connectDatabase = async (connectionOptions = {}) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(
      config.database.uri,
      {
        serverSelectionTimeoutMS:
          config.database.serverSelectionTimeoutMS,
        ...connectionOptions,
      },
    );

    registerConnectionListeners();

    logger.info(`Connected to MongoDB database: ${mongoose.connection.name}`);

    return mongoose.connection;
  } catch (error) {
    throw new Error(
      `Failed to connect to MongoDB: ${getErrorMessage(error)}`,
      {
        cause: error,
      },
    );
  }
};

const disconnectDatabase = async () => {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  isDisconnectingIntentionally = true;

  try {
    await mongoose.disconnect();
  } catch (error) {
    throw new Error(
      `Failed to disconnect from MongoDB: ${getErrorMessage(error)}`,
      {
        cause: error,
      },
    );
  } finally {
    isDisconnectingIntentionally = false;
  }
};

export {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
};