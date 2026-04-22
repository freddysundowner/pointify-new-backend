/**
 * Cron scheduler. Wires up scheduled email jobs to run daily.
 *
 * Schedule (server local time):
 *   09:00  →  trial expiring soon (~3 days out)
 *   09:05  →  trial expired followup (~3 days after)
 *   09:10  →  signed-up-but-no-products nudge (~2 days after signup)
 *   09:15  →  has-products-but-no-sales nudge (5+ days idle)
 *   09:20  →  paid subscription renewal reminder (~3 days out)
 *
 * Disable in any environment by setting DISABLE_SCHEDULER=true.
 */
import cron from "node-cron";
import { logger } from "./logger.js";
import {
  jobTrialExpiringSoon,
  jobTrialExpiredFollowup,
  jobNoProductsNudge,
  jobNoSalesNudge,
  jobSubscriptionRenewalReminder,
  jobWelcomeFeaturesPitch,
} from "./scheduledNotifications.js";
import { jobDailyReport } from "./dailyReport.js";

let started = false;

export function startScheduler() {
  if (started) return;
  if (process.env["DISABLE_SCHEDULER"] === "true") {
    logger.info("scheduler: disabled via DISABLE_SCHEDULER=true");
    return;
  }
  started = true;

  cron.schedule("0 9 * * *", () => {
    void jobTrialExpiringSoon();
  });
  cron.schedule("5 9 * * *", () => {
    void jobTrialExpiredFollowup();
  });
  cron.schedule("10 9 * * *", () => {
    void jobNoProductsNudge();
  });
  cron.schedule("15 9 * * *", () => {
    void jobNoSalesNudge();
  });
  cron.schedule("20 9 * * *", () => {
    void jobSubscriptionRenewalReminder();
  });
  cron.schedule("25 9 * * *", () => {
    void jobWelcomeFeaturesPitch();
  });

  // Nightly admin digest with CSV attachments — 20:00 server time.
  cron.schedule("0 20 * * *", () => {
    void jobDailyReport();
  });

  logger.info("scheduler: registered 7 daily jobs (morning nudges + 20:00 daily report)");
}
