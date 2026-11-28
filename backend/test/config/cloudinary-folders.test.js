import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const readFolders = (rootFolder) => spawnSync(
  process.execPath,
  ["--input-type=module", "-e", "import folders from './src/constants/cloudinary-folder.js'; process.stdout.write(JSON.stringify(folders));"],
  {
    cwd: backendDirectory,
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "production", CLOUDINARY_ROOT_FOLDER: rootFolder },
  },
);

describe("Cloudinary environment folder root", () => {
  it("places every upload folder under the configured production root", () => {
    const result = readFolders("jobhub-production");

    expect(result.status).toBe(0);
    const folders = JSON.parse(result.stdout);
    expect(folders.CANDIDATE_UPLOADED_CVS).toBe("jobhub-production/candidate-cvs/uploaded");
    expect(folders.APPLICATION_SUBMITTED_CV_SNAPSHOTS).toBe("jobhub-production/applications/submitted-cv-snapshots");
    expect(Object.values(folders)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^jobhub-production\//)]),
    );
    expect(Object.values(folders).every((folder) => folder.startsWith("jobhub-production/"))).toBe(true);
  });

  it("rejects a nested root that could bypass the chosen environment folder", () => {
    const result = readFolders("jobhub/production");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("CLOUDINARY_ROOT_FOLDER must be a single non-empty folder name");
  });
});
