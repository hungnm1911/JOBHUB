import express from "express";
import cors from "cors";
import config from "./config/index.js";
import indexRouter from "./routes/index.js";
import errorHandler from "./middlewares/error-handler.js";
import notFound from "./middlewares/not-found.js";
import AppError from "./utils/app-error.js";

const app = express();
const corsAllowedOrigins = new Set(config.cors.allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsAllowedOrigins.has(origin)) {
      callback(null, true);

      return;
    }

    callback(new AppError(403, "Origin is not allowed by CORS"));
  },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", indexRouter);

app.use(notFound)
app.use(errorHandler);

export default app;
