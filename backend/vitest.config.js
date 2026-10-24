import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

const testTmpDir = join(homedir(), ".cache", "jobhub-backend-tests");
mkdirSync(testTmpDir, { recursive: true, mode: 0o700 });
process.env.TMPDIR = testTmpDir;

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.test.js"],
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
