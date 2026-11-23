import { describe, expect, it } from "vitest";

import {
  buildSourceRevision, issueOptimizationProposal, verifyOptimizationProposal,
} from "../../src/services/candidate-cv-optimization-proposal.service.js";

const ids = { candidateUserId: "u1", jobId: "j1", candidateCvId: "c1" };
const source = (overrides = {}) => ({
  _id: "c1", sourceType: "GENERATED", updatedAt: new Date(5), name: "CV",
  generatedContent: { skills: ["a"] }, ...overrides,
});
const issue = (overrides = {}, now = 1_000_000) => issueOptimizationProposal({
  ...ids,
  metadata: { name: "CV", categoryId: "cat1", skillTags: ["a"] },
  proposedContent: { skills: ["Node.js"], professionalSummary: "S" },
  sourceRevision: buildSourceRevision(source()),
  now,
  ...overrides,
});
const clone = (value) => JSON.parse(JSON.stringify(value));

describe("AI-V06 R2 Optimization Proposal signing", () => {
  it("issues a signed proposal with a 60 minute TTL that verifies for its identity", () => {
    const proposal = issue();

    expect(proposal.payload.expiresAt).toBe(new Date(1_000_000 + 3_600_000).toISOString());
    expect(proposal.payload.sourceRevision).toEqual({
      sourceType: "GENERATED", updatedAt: new Date(5).toISOString(),
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(verifyOptimizationProposal(clone(proposal), { ...ids, now: 1_000_001 }))
      .toEqual({ valid: true, reason: null });
  });

  it("is deterministic regardless of object key order", () => {
    const a = issue();
    const b = issue({ proposedContent: { professionalSummary: "S", skills: ["Node.js"] } });
    expect(b.signature).toBe(a.signature);
  });

  it.each([
    ["proposedContent", (p) => { p.payload.proposedContent.skills = ["Evil"]; }],
    ["metadata", (p) => { p.payload.metadata.name = "Other"; }],
    ["sourceRevision", (p) => { p.payload.sourceRevision.contentHash = "0".repeat(64); }],
    ["expiresAt", (p) => { p.payload.expiresAt = "2999-01-01T00:00:00.000Z"; }],
    ["jobId", (p) => { p.payload.jobId = "j2"; }],
    ["candidateCvId", (p) => { p.payload.candidateCvId = "c2"; }],
    ["candidateUserId", (p) => { p.payload.candidateUserId = "u2"; }],
    ["signature", (p) => { p.signature = `${p.signature.slice(0, -2)}AA`; }],
  ])("rejects tampered %s", (_name, tamper) => {
    const proposal = clone(issue());
    tamper(proposal);
    expect(verifyOptimizationProposal(proposal, { ...ids, now: 1_000_001 }).valid).toBe(false);
  });

  it("does not let baseline-only data influence the signature", () => {
    const proposal = clone(issue());
    proposal.baseline = { skills: ["x"] };
    expect(verifyOptimizationProposal(proposal, { ...ids, now: 1_000_001 }).valid).toBe(true);
  });

  it("rejects other Candidate, Job or Source CV identity and expired proposals", () => {
    const proposal = clone(issue());
    const now = 1_000_001;
    for (const other of [{ candidateUserId: "u2" }, { jobId: "j2" }, { candidateCvId: "c2" }]) {
      expect(verifyOptimizationProposal(proposal, { ...ids, ...other, now }))
        .toEqual({ valid: false, reason: "IDENTITY_MISMATCH" });
    }
    expect(verifyOptimizationProposal(proposal, { ...ids, now: 1_000_000 + 3_600_000 }).reason)
      .toBe("EXPIRED");
    expect(verifyOptimizationProposal(null, ids).reason).toBe("MALFORMED");
  });

  it("detects same-updatedAt content edits for Generated and Uploaded sources", () => {
    const hash = (value) => buildSourceRevision(value).contentHash;
    expect(hash(source({ generatedContent: { skills: ["b"] } }))).not.toBe(hash(source()));
    expect(hash(source({ name: "Other" }))).not.toBe(hash(source()));
    expect(hash(source({ status: "ACTIVE" }))).not.toBe(hash(source()));
    const uploaded = (file) => source({
      sourceType: "UPLOADED", generatedContent: undefined, uploadedFile: file,
    });
    expect(hash(uploaded({ storageKey: "a.pdf" }))).not.toBe(hash(uploaded({ storageKey: "b.pdf" })));
    expect(hash(source())).toBe(hash(source()));
  });

  it.each([
    ["missing updatedAt", { updatedAt: undefined }],
    ["invalid updatedAt", { updatedAt: "nope" }],
    ["missing Generated content", { generatedContent: null }],
    ["unknown source type", { sourceType: "OTHER" }],
  ])("refuses to establish a revision for %s", (_name, overrides) => {
    expect(() => buildSourceRevision(source(overrides))).toThrow("revision cannot be established");
  });
});
