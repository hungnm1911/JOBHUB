import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import config from "../config/index.js";
import AppError from "../utils/app-error.js";

// AI-V06 F03 / Data §6.7: stateless Optimization Proposal. Nothing is persisted;
// the signature covers identity, Source revision, metadata and proposedContent.
const PROPOSAL_VERSION = 1;
const SIGNING_CONTEXT = "jobhub:ai-v06:optimization-proposal:v1";

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};

const signingKey = () => createHmac("sha256", config.optimizationProposal.signingSecret)
  .update(SIGNING_CONTEXT).digest();

const computeSignature = (payload) => createHmac("sha256", signingKey())
  .update(JSON.stringify(canonicalize(payload))).digest("base64url");

// Source revision from the authorized request-local CV snapshot. CandidateCV has
// no version key and updatedAt alone misses same-millisecond edits (see the V7
// activation commit), so the revision also fingerprints every persisted field of
// the snapshot. Commit recomputes it from the current CV with this same builder.
// Untrustworthy or incomplete snapshots are never signed.
const buildSourceRevision = (source) => {
  const plain = source && typeof source.toObject === "function" ? source.toObject() : source;
  const updatedAt = plain?.updatedAt == null ? Number.NaN : new Date(plain.updatedAt).getTime();
  const content = plain?.sourceType === "GENERATED" ? plain.generatedContent
    : plain?.sourceType === "UPLOADED" ? plain.uploadedFile : null;
  if (Number.isNaN(updatedAt) || content == null || typeof content !== "object") {
    throw new AppError(500, "Source CV revision cannot be established");
  }
  return {
    sourceType: plain.sourceType,
    updatedAt: new Date(updatedAt).toISOString(),
    contentHash: createHash("sha256")
      .update(JSON.stringify(canonicalize(JSON.parse(JSON.stringify(plain)))))
      .digest("hex"),
  };
};

const issueOptimizationProposal = ({
  candidateUserId, jobId, candidateCvId, metadata, proposedContent, sourceRevision,
  now = Date.now(),
}) => {
  // JSON round-trip so the signed value equals what the client receives.
  const payload = JSON.parse(JSON.stringify({
    version: PROPOSAL_VERSION,
    candidateUserId: candidateUserId.toString(),
    jobId: jobId.toString(),
    candidateCvId: candidateCvId.toString(),
    metadata,
    proposedContent,
    sourceRevision,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + config.optimizationProposal.ttlMs).toISOString(),
  }));
  return { payload, signature: computeSignature(payload) };
};

// Returns { valid, reason }; Commit (later slice) maps reasons to HTTP errors.
const verifyOptimizationProposal = (proposal, { candidateUserId, jobId, candidateCvId, now = Date.now() } = {}) => {
  const { payload, signature } = proposal ?? {};
  if (!payload || typeof payload !== "object" || typeof signature !== "string") {
    return { valid: false, reason: "MALFORMED" };
  }
  const expected = Buffer.from(computeSignature(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }
  if (payload.version !== PROPOSAL_VERSION) return { valid: false, reason: "MALFORMED" };
  if (!(Date.parse(payload.expiresAt) > now)) return { valid: false, reason: "EXPIRED" };
  if (payload.candidateUserId !== candidateUserId?.toString()
    || payload.jobId !== jobId?.toString()
    || payload.candidateCvId !== candidateCvId?.toString()) {
    return { valid: false, reason: "IDENTITY_MISMATCH" };
  }
  return { valid: true, reason: null };
};

export { buildSourceRevision, issueOptimizationProposal, verifyOptimizationProposal };
