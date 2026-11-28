import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import mongoose from "mongoose";

import config from "../src/config/index.js";
import {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
} from "../src/config/mongodb.js";
import USER_ROLE from "../src/constants/user-role.js";
import USER_STATUS from "../src/constants/user-status.js";
import User from "../src/models/user.model.js";
import { hashPassword, verifyPassword } from "../src/utils/hash-password.js";

const HOST = "jobhub-prod.a956r7b.mongodb.net";
const DATABASE = "jobhub";
const DATA_URL = new URL(
  "../../tmp/production-seed-data/seed-normaliztion/production-candidates.json",
  import.meta.url,
);
const id = (value) => value?.toString();
const seedId = (namespace, key) =>
  new mongoose.Types.ObjectId(
    createHash("sha256")
      .update(`${namespace}:${key}:user`)
      .digest("hex")
      .slice(0, 24),
  );

const assertProductionTarget = () => {
  let target;
  try {
    target = new URL(config.database.uri);
  } catch {
    throw new Error("Malformed MongoDB URI");
  }
  if (
    config.env !== "production" ||
    target.protocol !== "mongodb+srv:" ||
    target.hostname !== HOST ||
    decodeURIComponent(target.pathname) !== `/${DATABASE}`
  ) {
    throw new Error("Production Atlas target guard failed");
  }
};

const loadSeed = async () => {
  const fileStat = await stat(DATA_URL);
  if ((fileStat.mode & 0o077) !== 0) {
    throw new Error("Candidate JSON must be owner-only (chmod 600)");
  }
  const data = JSON.parse(await readFile(DATA_URL, "utf8"));
  if (
    data.version !== 1 ||
    data.namespace !== "jobhub-production-candidates-v1" ||
    data.kind !== "synthetic-candidate-accounts" ||
    !Array.isArray(data.records) ||
    data.records.length !== 200
  ) {
    throw new Error("Candidate seed identity/count mismatch");
  }
  const keys = new Set();
  const emails = new Set();
  const names = new Set();
  const rows = data.records.map((candidate, index) => {
    const expectedKey = `candidate-${String(index + 1).padStart(3, "0")}`;
    const expectedEmail = `ungvien${String(index + 1).padStart(3, "0")}@accounts.jobhub.invalid`;
    const birthDate = new Date(`${candidate.dateOfBirth}T00:00:00.000Z`);
    if (
      candidate.key !== expectedKey ||
      candidate.email !== expectedEmail ||
      typeof candidate.fullName !== "string" ||
      !candidate.fullName.trim() ||
      candidate.fullName.length > 100 ||
      typeof candidate.password !== "string" ||
      candidate.password.length < 8 ||
      candidate.password.length > 64 ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(candidate.dateOfBirth) ||
      Number.isNaN(birthDate.getTime()) ||
      birthDate.toISOString().slice(0, 10) !== candidate.dateOfBirth ||
      birthDate > new Date() ||
      keys.has(candidate.key) ||
      emails.has(candidate.email) ||
      names.has(candidate.fullName)
    ) {
      throw new Error("Invalid or duplicate Candidate definition");
    }
    keys.add(candidate.key);
    emails.add(candidate.email);
    names.add(candidate.fullName);
    return {
      ...candidate,
      birthDate,
      userId: seedId(data.namespace, candidate.key),
    };
  });
  return rows;
};

const inspectExisting = async (rows) => {
  const userIds = rows.map((row) => row.userId);
  const emails = rows.map((row) => row.email);
  const users = await User.find({
    $or: [{ _id: { $in: userIds } }, { email: { $in: emails } }],
  }).select("+passwordHash").lean();
  const expectedIds = new Set(userIds.map(id));
  if (users.some((user) => !expectedIds.has(id(user._id)))) {
    throw new Error("Candidate email or identity collision");
  }
  const usersById = new Map(users.map((user) => [id(user._id), user]));
  const complete = new Set();
  for (const row of rows) {
    const user = usersById.get(id(row.userId));
    if (!user) continue;
    if (
      user.email !== row.email ||
      user.fullName !== row.fullName ||
      user.dateOfBirth?.toISOString().slice(0, 10) !== row.dateOfBirth ||
      user.role !== USER_ROLE.CANDIDATE ||
      user.status !== USER_STATUS.ACTIVE ||
      !user.emailVerifiedAt ||
      user.mustChangePassword !== false ||
      !(await verifyPassword(row.password, user.passwordHash))
    ) {
      throw new Error("Existing Candidate seed drift or partial write");
    }
    complete.add(row.key);
  }
  return complete;
};

const run = async (apply) => {
  assertProductionTarget();
  const rows = await loadSeed();
  let connected = false;
  try {
    const connection = await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);
    connected = true;
    if (connection.name !== DATABASE) {
      throw new Error("Connected database guard failed");
    }
    const before = await inspectExisting(rows);
    const report = {
      target: `${HOST}/${DATABASE}`,
      mode: apply ? "apply" : "dry-run",
      expectedCandidates: 200,
      existing: before.size,
      missing: 200 - before.size,
    };
    if (!apply) return report;

    await User.createIndexes();
    let created = 0;
    for (const row of rows) {
      if (before.has(row.key)) continue;
      await User.create({
        _id: row.userId,
        fullName: row.fullName,
        email: row.email,
        dateOfBirth: row.birthDate,
        passwordHash: await hashPassword(row.password),
        role: USER_ROLE.CANDIDATE,
        status: USER_STATUS.ACTIVE,
        emailVerifiedAt: new Date(),
        mustChangePassword: false,
      });
      created += 1;
      if (created % 25 === 0) {
        process.stdout.write(`Created ${created}/200 Candidates\n`);
      }
    }
    const after = await inspectExisting(rows);
    if (after.size !== 200) {
      throw new Error("Candidate seed verification failed");
    }
    return { ...report, created, verified: after.size };
  } finally {
    if (connected) await disconnectDatabase();
  }
};

const args = process.argv.slice(2);
if (args.length !== 1 || !["--dry-run", "--apply"].includes(args[0])) {
  process.stderr.write("Usage: node scripts/seed-production-candidates.js --dry-run|--apply\n");
  process.exitCode = 2;
} else {
  try {
    process.stdout.write(`${JSON.stringify(await run(args[0] === "--apply"), null, 2)}\n`);
  } catch {
    // Driver errors can contain a MongoDB URI; never print raw errors or credentials.
    process.stderr.write("Production Candidate seed failed. Check local data and retry dry-run.\n");
    process.exitCode = 1;
  }
}
