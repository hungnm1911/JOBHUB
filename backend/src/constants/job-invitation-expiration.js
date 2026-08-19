/**
 * V15 Slice 02 / BR-23 Send cutoff.
 * Calendar date containing sentAt in this timezone is Day 1.
 * Own cutoff is 00:00 at the start of Day 16.
 * Effective expiresAt is the earlier of own cutoff and Job.applicationDeadline.
 */
const JOB_INVITATION_EXPIRATION = Object.freeze({
  TIMEZONE: "Asia/Ho_Chi_Minh",
  OWN_CUTOFF_DAY_OFFSET: 15,
});

export default JOB_INVITATION_EXPIRATION;
