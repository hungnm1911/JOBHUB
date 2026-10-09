import express from "express";
import cors from "cors";
import config from "./config/index.js";
import HTTP_HEADER from "./constants/http-header.js";
import indexRouter from "./routes/index.js";
import errorHandler from "./middlewares/error-handler.js";
import notFound from "./middlewares/not-found.js";
import requestLogger from "./middlewares/request-logger.js";
import AppError from "./utils/app-error.js";

const app = express();
const corsAllowedOrigins = new Set(config.cors.allowedOrigins);

app.use(requestLogger);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsAllowedOrigins.has(origin)) {
      callback(null, true);

      return;
    }

    callback(new AppError(403, "Origin is not allowed by CORS"));
  },
  exposedHeaders: [HTTP_HEADER.REQUEST_ID],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", indexRouter);

app.use(notFound)
app.use(errorHandler);

export default app;
