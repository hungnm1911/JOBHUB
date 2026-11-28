import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import mongoose from "mongoose";

import config from "../src/config/index.js";
import {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
} from "../src/config/mongodb.js";
import COMPANY_APPROVAL_STATUS from "../src/constants/company-approval-status.js";
import COMPANY_MEMBER_ROLE from "../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../src/constants/company-member-status.js";
import COMPANY_OPERATIONAL_STATUS from "../src/constants/company-operational-status.js";
import USER_ROLE from "../src/constants/user-role.js";
import USER_STATUS from "../src/constants/user-status.js";
import Category from "../src/models/category.model.js";
import Company from "../src/models/company.model.js";
import CompanyMember from "../src/models/company-member.model.js";
import User from "../src/models/user.model.js";
import { hashPassword, verifyPassword } from "../src/utils/hash-password.js";

const HOST = "jobhub-prod.a956r7b.mongodb.net";
const DATABASE = "jobhub";
const DATA_URL = new URL(
  "../../tmp/production-seed-data/seed-normaliztion/production-recruiters.json",
  import.meta.url,
);
const id = (value) => value?.toString();
const seedId = (namespace, key, kind) =>
  new mongoose.Types.ObjectId(
    createHash("sha256")
      .update(`${namespace}:${key}:${kind}`)
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
    throw new Error("Recruiter JSON must be owner-only (chmod 600)");
  }

  const data = JSON.parse(await readFile(DATA_URL, "utf8"));
  if (
    data.version !== 1 ||
    data.namespace !== "jobhub-production-recruiters-v1" ||
    !Array.isArray(data.companies) ||
    data.companies.length !== 50
  ) {
    throw new Error("Recruiter seed identity/count mismatch");
  }

  const companyKeys = new Set();
  const recruiterKeys = new Set();
  const emails = new Set();
  const rows = [];
  for (const entry of data.companies) {
    const company = entry.company;
    if (
      typeof company?.key !== "string" ||
      typeof company.name !== "string" ||
      typeof company.field !== "string" ||
      typeof company.businessRegistrationNumber !== "string" ||
      !Array.isArray(entry.recruiters) ||
      entry.recruiters.length !== 3 ||
      companyKeys.has(company.key)
    ) {
      throw new Error("Invalid Recruiter company group");
    }
    companyKeys.add(company.key);

    const employeeCodes = new Set();
    for (const recruiter of entry.recruiters) {
      if (
        typeof recruiter.key !== "string" ||
        typeof recruiter.fullName !== "string" ||
        !recruiter.fullName.trim() ||
        recruiter.fullName.trim().startsWith("[") ||
        !/^tuyendung\d{3}@accounts\.jobhub\.invalid$/u.test(
          recruiter.email,
        ) ||
        typeof recruiter.password !== "string" ||
        recruiter.password.length < 8 ||
        recruiter.password.length > 64 ||
        typeof recruiter.employeeCode !== "string" ||
        typeof recruiter.jobTitle !== "string" ||
        !recruiter.jobTitle.trim() ||
        recruiterKeys.has(recruiter.key) ||
        emails.has(recruiter.email) ||
        employeeCodes.has(recruiter.employeeCode)
      ) {
        throw new Error("Invalid or duplicate Recruiter definition");
      }
      recruiterKeys.add(recruiter.key);
      emails.add(recruiter.email);
      employeeCodes.add(recruiter.employeeCode);
      rows.push({
        ...recruiter,
        company,
        userId: seedId(data.namespace, recruiter.key, "user"),
        memberId: seedId(data.namespace, recruiter.key, "member"),
      });
    }
    if (["REC-01", "REC-02", "REC-03"].some((code) => !employeeCodes.has(code))) {
      throw new Error("Each Company must have three distinct Recruiter codes");
    }
  }
  if (rows.length !== 150) throw new Error("Expected exactly 150 Recruiters");
  return { companies: data.companies, rows };
};

const loadCompanyTargets = async (companies) => {
  const expected = new Map(
    companies.map((entry) => [entry.company.businessRegistrationNumber, entry.company]),
  );
  if (expected.size !== 50) {
    throw new Error("Duplicate Company registration number in Recruiter seed");
  }

  const [actualCompanies, fields] = await Promise.all([
    Company.find({
      businessRegistrationNumber: { $in: [...expected.keys()] },
    }).lean(),
    Category.find({ level: "FIELD" }).select("name").lean(),
  ]);
  if (actualCompanies.length !== 50) {
    throw new Error("Production Company catalog is incomplete");
  }
  const fieldNames = new Set(fields.map((field) => field.name));
  const companyIds = actualCompanies.map((company) => company._id);
  const managers = await CompanyMember.find({
    companyId: { $in: companyIds },
    role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
  }).lean();
  const managerUsers = await User.find({
    _id: { $in: managers.map((manager) => manager.userId) },
  }).lean();
  const managerUserById = new Map(managerUsers.map((user) => [id(user._id), user]));
  const managersByCompany = new Map();
  for (const manager of managers) {
    const key = id(manager.companyId);
    if (managersByCompany.has(key)) {
      throw new Error("Company has more than one Manager");
    }
    managersByCompany.set(key, manager);
  }

  const byRegistrationNumber = new Map();
  for (const company of actualCompanies) {
    const definition = expected.get(company.businessRegistrationNumber);
    const manager = managersByCompany.get(id(company._id));
    const managerUser = managerUserById.get(id(manager?.userId));
    if (
      !definition ||
      company.name !== definition.name ||
      !fieldNames.has(definition.field) ||
      company.approvalStatus !== COMPANY_APPROVAL_STATUS.APPROVED ||
      company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.ACTIVE ||
      manager?.status !== COMPANY_MEMBER_STATUS.ACTIVE ||
      managerUser?.role !== USER_ROLE.COMPANY_STAFF ||
      managerUser.status !== USER_STATUS.ACTIVE ||
      !managerUser.emailVerifiedAt ||
      managerUser.mustChangePassword !== false
    ) {
      throw new Error("Production Company/Manager target is not ready");
    }
    byRegistrationNumber.set(company.businessRegistrationNumber, company);
  }
  return byRegistrationNumber;
};

const inspectExisting = async (rows, companyByNumber) => {
  const userIds = rows.map((row) => row.userId);
  const memberIds = rows.map((row) => row.memberId);
  const emails = rows.map((row) => row.email);
  const companyIds = [...companyByNumber.values()].map((company) => company._id);
  const [users, members] = await Promise.all([
    User.find({
      $or: [{ _id: { $in: userIds } }, { email: { $in: emails } }],
    }).select("+passwordHash").lean(),
    CompanyMember.find({
      $or: [
        { _id: { $in: memberIds } },
        { userId: { $in: userIds } },
        {
          companyId: { $in: companyIds },
          role: COMPANY_MEMBER_ROLE.RECRUITER,
        },
      ],
    }).lean(),
  ]);
  const expectedUserIds = new Set(userIds.map(id));
  const expectedMemberIds = new Set(memberIds.map(id));
  if (
    users.some((user) => !expectedUserIds.has(id(user._id))) ||
    members.some((member) => !expectedMemberIds.has(id(member._id)))
  ) {
    throw new Error("Existing Recruiter identity or employee-code collision");
  }
  const usersById = new Map(users.map((user) => [id(user._id), user]));
  const membersById = new Map(members.map((member) => [id(member._id), member]));
  const complete = new Set();
  for (const row of rows) {
    const user = usersById.get(id(row.userId));
    const member = membersById.get(id(row.memberId));
    if (!user && !member) continue;
    const companyId = id(companyByNumber.get(row.company.businessRegistrationNumber)._id);
    if (
      !user ||
      !member ||
      user.fullName !== row.fullName ||
      user.email !== row.email ||
      user.role !== USER_ROLE.COMPANY_STAFF ||
      user.status !== USER_STATUS.ACTIVE ||
      !user.emailVerifiedAt ||
      user.mustChangePassword !== false ||
      !(await verifyPassword(row.password, user.passwordHash)) ||
      id(member.userId) !== id(row.userId) ||
      id(member.companyId) !== companyId ||
      member.role !== COMPANY_MEMBER_ROLE.RECRUITER ||
      member.status !== COMPANY_MEMBER_STATUS.ACTIVE ||
      member.employeeCode !== row.employeeCode ||
      member.jobTitle !== row.jobTitle
    ) {
      throw new Error("Existing Recruiter seed drift or partial write");
    }
    complete.add(row.key);
  }
  return complete;
};

const createOne = async (row, companyId) => {
  const passwordHash = await hashPassword(row.password);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await User.create(
        [{
          _id: row.userId,
          fullName: row.fullName,
          email: row.email,
          passwordHash,
          role: USER_ROLE.COMPANY_STAFF,
          status: USER_STATUS.ACTIVE,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
        }],
        { session },
      );
      await CompanyMember.create(
        [{
          _id: row.memberId,
          userId: row.userId,
          companyId,
          role: COMPANY_MEMBER_ROLE.RECRUITER,
          status: COMPANY_MEMBER_STATUS.ACTIVE,
          employeeCode: row.employeeCode,
          jobTitle: row.jobTitle,
        }],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
};

const run = async (apply) => {
  assertProductionTarget();
  const { companies, rows } = await loadSeed();
  let connected = false;
  try {
    const connection = await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);
    connected = true;
    if (connection.name !== DATABASE) throw new Error("Connected database guard failed");
    const companyByNumber = await loadCompanyTargets(companies);
    const before = await inspectExisting(rows, companyByNumber);
    const report = {
      target: `${HOST}/${DATABASE}`,
      mode: apply ? "apply" : "dry-run",
      companies: 50,
      recruitersPerCompany: 3,
      expectedRecruiters: 150,
      existing: before.size,
      missing: 150 - before.size,
    };
    if (!apply) return report;

    await Promise.all([User.createIndexes(), CompanyMember.createIndexes()]);
    for (const row of rows) {
      if (before.has(row.key)) continue;
      const company = companyByNumber.get(row.company.businessRegistrationNumber);
      await createOne(row, company._id);
    }
    const after = await inspectExisting(rows, companyByNumber);
    if (after.size !== 150) throw new Error("Recruiter seed verification failed");
    return { ...report, created: after.size - before.size, verified: after.size };
  } finally {
    if (connected) await disconnectDatabase();
  }
};

const args = process.argv.slice(2);
if (args.length !== 1 || !["--dry-run", "--apply"].includes(args[0])) {
  process.stderr.write("Usage: node scripts/seed-production-recruiters.js --dry-run|--apply\n");
  process.exitCode = 2;
} else {
  try {
    process.stdout.write(`${JSON.stringify(await run(args[0] === "--apply"), null, 2)}\n`);
  } catch {
    // Driver errors may contain a URI; never print raw errors or credentials.
    process.stderr.write(
      "Production Recruiter seed failed. Run dry-run and inspect the local data before retrying.\n",
    );
    process.exitCode = 1;
  }
}
