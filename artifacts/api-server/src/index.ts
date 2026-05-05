import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./lib/scheduler";
import {
  seedDefaultEmailConfig,
  seedDefaultEmailTemplates,
  seedDefaultMeasures,
  seedDefaultPaymentMethods,
  seedDefaultPermissions,
  seedDefaultShopCategories,
  seedDefaultSmsTemplates,
  seedDefaultTrialConfig,
} from "./lib/seedDefaults";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(`Server listening on port ${port}`);
  void seedDefaultPaymentMethods();
  void seedDefaultPermissions();
  void seedDefaultShopCategories();
  void seedDefaultMeasures();
  void seedDefaultSmsTemplates();
  void seedDefaultEmailTemplates();
  void seedDefaultEmailConfig();
  void seedDefaultTrialConfig();
  startScheduler();
});
