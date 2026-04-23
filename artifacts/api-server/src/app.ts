import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
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

// Skip JSON parsing for payment-gateway webhook routes — those handlers mount
// their own `express.raw()` so signature verification can hash the exact bytes
// the provider sent. If we let the global JSON parser run first it consumes
// the stream and the route-level raw parser sees an empty body.
const WEBHOOK_PATH_RE = /^\/api\/payments\/[^/]+\/webhook\/?$/;
app.use((req, res, next) => {
  if (WEBHOOK_PATH_RE.test(req.path)) return next();
  return express.json({ limit: "10mb" })(req, res, next);
});
app.use((req, res, next) => {
  if (WEBHOOK_PATH_RE.test(req.path)) return next();
  return express.urlencoded({ extended: true })(req, res, next);
});

app.get("/api/openapi.json", (_req, res) => res.json(openApiSpec));

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec as any, {
    customSiteTitle: "Pointify POS API",
    swaggerOptions: {
      docExpansion: "none",
      defaultModelsExpandDepth: -1,
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
    customCss: `
      .swagger-ui .topbar { background-color: #6b21a8; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info h2.title { color: #6b21a8; }
    `,
  }),
);

app.use("/api", router);

app.use(errorHandler);

export default app;
