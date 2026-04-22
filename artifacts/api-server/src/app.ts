import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { apiReference } from "@scalar/express-api-reference";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/error.js";
import { logger } from "./lib/logger.js";
import { openApiSpec } from "./openapi/spec.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/openapi.json", (_req, res) => res.json(openApiSpec));

app.use(
  "/api/docs",
  apiReference({
    spec: { url: "/api/openapi.json" },
    theme: "purple",
  }),
);

app.use("/api", router);

app.use(errorHandler);

export default app;
