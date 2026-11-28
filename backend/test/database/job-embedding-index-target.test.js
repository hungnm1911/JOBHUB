import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = path.join(backendDirectory, "scripts", "manage-job-embedding-index.js");

const run = ({ uri, env = "production", args = [] }) => spawnSync(
  process.execPath,
  [script, ...args],
  {
    cwd: backendDirectory,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: env, MONGODB_URI: uri },
  },
);

describe("Job embedding index target guard", () => {
  const productionUri = "mongodb+srv://operator:password@jobhub-prod.example.mongodb.net/jobhub_production";
  const developmentUri = "mongodb+srv://operator:password@jobhub-dev.cffome0.mongodb.net/jobhub";

  it("requires an explicit production host and database before connecting", () => {
    const result = run({ uri: productionUri, args: ["--create"] });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--production-target");
  });

  it("rejects production commands aimed at the development Atlas host", () => {
    const result = run({
      uri: developmentUri,
      args: ["--create", "--production-target", "jobhub-dev.cffome0.mongodb.net", "jobhub"],
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing to access a production MongoDB target");
  });

  it("rejects a mismatch between the URI and declared production target", () => {
    const result = run({
      uri: productionUri,
      args: ["--create", "--production-target", "another-prod.example.mongodb.net", "jobhub_production"],
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing to access a production MongoDB target");
  });

  it("keeps the existing development command restricted to its known target", () => {
    const result = run({ uri: productionUri, env: "development", args: ["--create"] });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing to access a development target");
  });
});
