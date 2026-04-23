import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes/index.js";
import { errorHandler } from "./middlewares/error.js";
import { logger } from "./lib/logger.js";
import { openApiSpec } from "./openapi/spec.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage(req, res, responseTime) {
      const url = (req.url ?? "/").split("?")[0];
      return `${req.method} ${url} ${res.statusCode} — ${responseTime}ms`;
    },
    customErrorMessage(req, res, err) {
      const url = (req.url ?? "/").split("?")[0];
      return `${req.method} ${url} ${res.statusCode} — ${err.message}`;
    },
    serializers: {
      req: () => undefined,
      res: () => undefined,
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

app.get(["/api/docs", "/api/docs/"], (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pointify POS API</title>
</head>
<body>
  <script
    id="api-reference"
    data-url="/api/openapi.json"
    data-configuration='${JSON.stringify({
      theme: "purple",
      layout: "classic",
      defaultHttpClient: { targetKey: "javascript", clientKey: "fetch" },
      hideModels: false,
      searchHotKey: "k",
    })}'
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});

// Serve uploaded files (product images, etc.)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api", router);

app.use(errorHandler);

export default app;
