import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
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

app.get(["/api/docs", "/api/docs/"], (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pointify POS API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <style>
    body { margin: 0; }
    .swagger-ui .topbar { background-color: #6b21a8; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    #loading { display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; font-size:1.1rem; color:#6b21a8; }
  </style>
</head>
<body>
  <div id="loading">Loading API docs&hellip;</div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js"></script>
  <script>
    window.addEventListener('load', function () {
      document.getElementById('loading').style.display = 'none';
      SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: 'StandaloneLayout',
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        docExpansion: 'none',
        defaultModelsExpandDepth: -1,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      });
    });
  </script>
</body>
</html>`);
});

app.use("/api", router);

app.use(errorHandler);

export default app;
