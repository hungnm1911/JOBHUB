import config from "../config/index.js";
import { recoverPendingNotificationEvents } from "../services/notification.service.js";

let recoveryTimer = null;
let recoveryPassPromise = null;
let stopped = true;

const runRecoveryPass = async () => {
  if (recoveryPassPromise) {
    return recoveryPassPromise;
  }

  recoveryPassPromise = recoverPendingNotificationEvents({
    limit: config.notificationRecovery.batchSize,
  }).catch((error) => {
    console.error("Notification recovery pass failed:", error);
  }).finally(() => {
    recoveryPassPromise = null;
  });

  return recoveryPassPromise;
};

const scheduleNextPass = () => {
  if (stopped) {
    return;
  }

  recoveryTimer = setTimeout(async () => {
    await runRecoveryPass();
    scheduleNextPass();
  }, config.notificationRecovery.intervalMs);

  recoveryTimer.unref();
};

const startNotificationRecoveryWorker = () => {
  if (!stopped) {
    return;
  }

  stopped = false;
  void runRecoveryPass().finally(scheduleNextPass);
};

const stopNotificationRecoveryWorker = async () => {
  stopped = true;

  if (recoveryTimer) {
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
  }

  if (recoveryPassPromise) {
    await recoveryPassPromise;
  }
};

export {
  startNotificationRecoveryWorker,
  stopNotificationRecoveryWorker,
};
