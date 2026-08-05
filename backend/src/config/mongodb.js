import mongoose from "mongoose";

import config from "../config/index.js";

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
    console.error(
      "MongoDB connection error:",
      getErrorMessage(error),
    );
  });

  mongoose.connection.on("disconnected", () => {
    if (isDisconnectingIntentionally) {
      console.log("MongoDB disconnected safely.");

      return;
    }

    console.warn("MongoDB connection was lost.");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected successfully.");
  });

  areConnectionListenersRegistered = true;
};

const connectDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(
      config.database.uri,
      {
        serverSelectionTimeoutMS:
          config.database.serverSelectionTimeoutMS,
      },
    );

    registerConnectionListeners();

    console.log(
      `Connected to MongoDB database: ${mongoose.connection.name}`,
    );

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
};