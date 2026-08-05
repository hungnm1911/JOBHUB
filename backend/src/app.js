import express from "express";
import indexRouter from "./routes/index.js";
import errorHandler from "./middlewares/error-handler.js";
import notFound from "./middlewares/not-found.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", indexRouter);

app.use(notFound)
app.use(errorHandler);

export default app;