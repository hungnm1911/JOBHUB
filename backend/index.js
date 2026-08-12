import app from "./src/app.js";
import config from "./src/config/index.js";

import {
  verifyCloudinaryConnection,
} from "./src/config/cloudinary.js";

import {
  connectDatabase,
  disconnectDatabase,
} from "./src/config/mongodb.js";
import { ensureApplicationCollectionInvariants } from "./src/models/application.model.js";
import { ensureCandidateCvCollectionInvariants } from "./src/models/candidate-cv.model.js";
import { ensureCompanyCollectionInvariants } from "./src/models/company.model.js";
import { ensureJobCollectionInvariants } from "./src/models/job.model.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

let httpServer = null;
let isShuttingDown = false;

const startHttpServer = () => {
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port);

    const handleListening = () => {
      server.off("error", handleStartupError);

      resolve(server);
    };

    const handleStartupError = (error) => {
      server.off("listening", handleListening);

      reject(error);
    };

    server.once("listening", handleListening);
    server.once("error", handleStartupError);
  });
};

const closeHttpServer = async () => {
  if (!httpServer || !httpServer.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);

        return;
      }

      resolve();
    });
  });

  httpServer = null;

  console.log("HTTP server closed.");
};

const shutdown = async ({
  reason,
  exitCode = 0,
}) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`Shutting down application: ${reason}`);

  const forceShutdownTimer = setTimeout(() => {
    console.error(
      `Graceful shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms. Forcing exit.`,
    );

    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  forceShutdownTimer.unref();

  let finalExitCode = exitCode;

  try {
    await closeHttpServer();
  } catch (error) {
    finalExitCode = 1;

    console.error(
      "Failed to close HTTP server:",
      error,
    );
  }

  try {
    await disconnectDatabase();
  } catch (error) {
    finalExitCode = 1;

    console.error(
      "Failed to disconnect from MongoDB:",
      error,
    );
  }

  clearTimeout(forceShutdownTimer);

  process.exitCode = finalExitCode;

  if (finalExitCode === 0) {
    console.log("Application shut down successfully.");
  } else {
    console.error("Application shut down with errors.");
  }
};

const startServer = async () => {
  await connectDatabase();
  await ensureCompanyCollectionInvariants();
  await ensureJobCollectionInvariants();
  await ensureCandidateCvCollectionInvariants();
  await ensureApplicationCollectionInvariants();

  await verifyCloudinaryConnection();

  httpServer = await startHttpServer();

  httpServer.on("error", (error) => {
    console.error("HTTP server error:", error);

    void shutdown({
      reason: "HTTP server error",
      exitCode: 1,
    });
  });

  console.log(
    `Server is running at http://localhost:${config.port}`,
  );
};

process.once("SIGINT", () => {
  void shutdown({
    reason: "SIGINT received",
  });
});

process.once("SIGTERM", () => {
  void shutdown({
    reason: "SIGTERM received",
  });
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);

  if (isShuttingDown) {
    process.exit(1);
  }

  void shutdown({
    reason: "Uncaught exception",
    exitCode: 1,
  });
});

process.on("unhandledRejection", (reason) => {
  console.error(
    "Unhandled promise rejection:",
    reason,
  );
  
  if (isShuttingDown) {
    process.exit(1);
  }

  void shutdown({
    reason: "Unhandled promise rejection",
    exitCode: 1,
  });
});

try {
  await startServer();
} catch (error) {
  console.error(
    "Error starting the server:",
    error,
  );

  await shutdown({
    reason: "Server startup failed",
    exitCode: 1,
  });
}
