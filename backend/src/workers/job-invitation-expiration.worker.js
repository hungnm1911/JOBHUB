import config from "../config/index.js";
import { materializeDueExpiredJobInvitations } from "../services/job-invitation.service.js";

let expirationTimer = null;
let expirationPassPromise = null;
let stopped = true;

const runExpirationPass = async () => {
  if (expirationPassPromise) {
    return expirationPassPromise;
  }

  expirationPassPromise = materializeDueExpiredJobInvitations({
    now: new Date(),
  }).catch((error) => {
    console.error("Job Invitation expiration pass failed:", error);
  }).finally(() => {
    expirationPassPromise = null;
  });

  return expirationPassPromise;
};

const scheduleNextPass = () => {
  if (stopped) {
    return;
  }

  expirationTimer = setTimeout(async () => {
    await runExpirationPass();
    scheduleNextPass();
  }, config.jobInvitationExpiration.intervalMs);

  expirationTimer.unref();
};

const startJobInvitationExpirationWorker = () => {
  if (!stopped) {
    return expirationPassPromise ?? Promise.resolve();
  }

  stopped = false;

  return runExpirationPass().finally(scheduleNextPass);
};

const stopJobInvitationExpirationWorker = async () => {
  stopped = true;

  if (expirationTimer) {
    clearTimeout(expirationTimer);
    expirationTimer = null;
  }

  if (expirationPassPromise) {
    await expirationPassPromise;
  }
};

export {
  startJobInvitationExpirationWorker,
  stopJobInvitationExpirationWorker,
};
