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
import Company, {
  ensureCompanyCollectionInvariants,
} from "../src/models/company.model.js";
import CompanyMember from "../src/models/company-member.model.js";
import User from "../src/models/user.model.js";
import { normalizeRichText } from "../src/services/rich-text.service.js";
import { hashPassword, verifyPassword } from "../src/utils/hash-password.js";

const EXPECTED_HOST = "jobhub-prod.a956r7b.mongodb.net";
const EXPECTED_DATABASE = "jobhub";
const DATA_URL = new URL(
  "../../tmp/production-seed-data/seed-normaliztion/production-companies.json",
  import.meta.url,
);
const CREDENTIALS_URL = new URL(
  "../../tmp/production-seed-data/seed-normaliztion/company-manager-credentials.json",
  import.meta.url,
);

const idFor = (namespace, key, kind) =>
  new mongoose.Types.ObjectId(
    createHash("sha256")
      .update(`${namespace}:${key}:${kind}`)
      .digest("hex")
      .slice(0, 24),
  );
const id = (value) => value?.toString();

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
    target.hostname !== EXPECTED_HOST ||
    decodeURIComponent(target.pathname) !== `/${EXPECTED_DATABASE}`
  ) {
    throw new Error("Production Atlas target guard failed");
  }
};

const loadDefinitions = async () => {
  const credentialStat = await stat(CREDENTIALS_URL);
  if ((credentialStat.mode & 0o077) !== 0) {
    throw new Error("Credential file must be owner-only (chmod 600)");
  }

  const data = JSON.parse(await readFile(DATA_URL, "utf8"));
  const credentials = JSON.parse(await readFile(CREDENTIALS_URL, "utf8"));
  if (
    data.version !== 1 ||
    data.namespace !== "jobhub-production-company-catalog-v1" ||
    !Array.isArray(data.records) ||
    data.records.length !== 50 ||
    Object.keys(credentials).length !== 50
  ) {
    throw new Error("Production Company dataset identity/count mismatch");
  }

  const keys = new Set();
  const names = new Set();
  const emails = new Set();
  const numbers = new Set();
  const fields = new Set();

  const definitions = data.records.map((row) => {
    const email = row.manager?.email;
    const password = credentials[email];
    const normalized = normalizeRichText(row.descriptionHtml, "full");
    const words = normalized.text.split(/\s+/u).length;
    if (
      typeof row.key !== "string" ||
      typeof row.name !== "string" ||
      typeof row.field !== "string" ||
      typeof row.manager?.fullName !== "string" ||
      typeof email !== "string" ||
      !/^quanly\d{2}@accounts\.jobhub\.invalid$/u.test(email) ||
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 64 ||
      !/^JH-PROD-SAMPLE-\d{4}$/u.test(row.businessRegistrationNumber) ||
      normalized.html !== row.descriptionHtml ||
      normalized.text !== row.description ||
      normalized.text.length > 5000 ||
      words < 490 ||
      words > 550 ||
      /^\s*\[/u.test(row.name) ||
      /^\s*\[/u.test(row.manager.fullName)
    ) {
      throw new Error(`Invalid Company seed definition: ${row.key}`);
    }

    for (const [value, set] of [
      [row.key, keys],
      [row.name, names],
      [email, emails],
      [row.businessRegistrationNumber, numbers],
    ]) {
      if (set.has(value)) throw new Error("Duplicate Company seed identity");
      set.add(value);
    }
    fields.add(row.field);

    return {
      ...row,
      email,
      password,
      userId: idFor(data.namespace, row.key, "user"),
      companyId: idFor(data.namespace, row.key, "company"),
      memberId: idFor(data.namespace, row.key, "member"),
    };
  });

  if (
    fields.size !== 25 ||
    definitions.filter((row) => row.field === "Công nghệ Thông tin").length !== 6
  ) {
    throw new Error("Production Company FIELD distribution mismatch");
  }

  return definitions;
};

const inspectExisting = async (definitions, adminId) => {
  const [users, companies, members] = await Promise.all([
    User.find({
      $or: [
        { _id: { $in: definitions.map((row) => row.userId) } },
        { email: { $in: definitions.map((row) => row.email) } },
      ],
    }).select("+passwordHash").lean(),
    Company.find({
      $or: [
        { _id: { $in: definitions.map((row) => row.companyId) } },
        {
          businessRegistrationNumber: {
            $in: definitions.map((row) => row.businessRegistrationNumber),
          },
        },
        { name: { $in: definitions.map((row) => row.name) } },
      ],
    }).lean(),
    CompanyMember.find({
      $or: [
        { _id: { $in: definitions.map((row) => row.memberId) } },
        { userId: { $in: definitions.map((row) => row.userId) } },
        { companyId: { $in: definitions.map((row) => row.companyId) } },
      ],
    }).lean(),
  ]);

  const byUserId = new Map(users.map((user) => [id(user._id), user]));
  const byCompanyId = new Map(companies.map((company) => [id(company._id), company]));
  const byMemberId = new Map(members.map((member) => [id(member._id), member]));
  const expected = new Map(definitions.map((row) => [id(row.companyId), row]));
  const expectedUserIds = new Set(definitions.map((row) => id(row.userId)));
  const expectedMemberIds = new Set(definitions.map((row) => id(row.memberId)));

  if (
    users.some((user) => !expectedUserIds.has(id(user._id))) ||
    companies.some((company) => !expected.has(id(company._id))) ||
    members.some((member) => !expectedMemberIds.has(id(member._id)))
  ) {
    throw new Error("Production Company seed identity collision");
  }

  let complete = 0;
  for (const row of definitions) {
    const user = byUserId.get(id(row.userId));
    const company = byCompanyId.get(id(row.companyId));
    const member = byMemberId.get(id(row.memberId));
    if (!user && !company && !member) continue;
    if (!user || !company || !member) {
      throw new Error(`Partial production Company seed: ${row.key}`);
    }

    if (
      user.fullName !== row.manager.fullName ||
      user.email !== row.email ||
      user.role !== USER_ROLE.COMPANY_STAFF ||
      user.status !== USER_STATUS.ACTIVE ||
      !user.emailVerifiedAt ||
      user.mustChangePassword !== false ||
      !(await verifyPassword(row.password, user.passwordHash)) ||
      company.name !== row.name ||
      company.businessRegistrationNumber !== row.businessRegistrationNumber ||
      company.description !== row.description ||
      company.descriptionHtml !== row.descriptionHtml ||
      company.approvalStatus !== COMPANY_APPROVAL_STATUS.APPROVED ||
      company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.ACTIVE ||
      id(company.reviewedByUserId) !== id(adminId) ||
      company.reviewSnapshot?.name !== row.name ||
      company.reviewSnapshot?.description !== row.description ||
      company.reviewSnapshot?.descriptionHtml !== row.descriptionHtml ||
      !company.submittedAt ||
      !company.reviewedAt ||
      !company.activatedAt ||
      id(member.userId) !== id(row.userId) ||
      id(member.companyId) !== id(row.companyId) ||
      member.role !== COMPANY_MEMBER_ROLE.COMPANY_MANAGER ||
      member.status !== COMPANY_MEMBER_STATUS.ACTIVE
    ) {
      throw new Error(`Production Company seed drift: ${row.key}`);
    }
    complete += 1;
  }

  return { complete, missing: definitions.length - complete };
};

const createOne = async (row, adminId) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const submittedAt = new Date(now.getTime() - 2000);
      const reviewedAt = new Date(now.getTime() - 1000);
      const profile = {
        name: row.name,
        logoUrl: null,
        bannerUrl: null,
        website: null,
        address: row.address,
        description: row.description,
        descriptionHtml: row.descriptionHtml,
        contactInfo: null,
        businessRegistrationNumber: row.businessRegistrationNumber,
      };
      await User.create(
        [{
          _id: row.userId,
          fullName: row.manager.fullName,
          email: row.email,
          passwordHash: await hashPassword(row.password),
          role: USER_ROLE.COMPANY_STAFF,
          status: USER_STATUS.ACTIVE,
          emailVerifiedAt: now,
          mustChangePassword: false,
        }],
        { session },
      );
      await Company.create(
        [{
          _id: row.companyId,
          ...profile,
          reviewSnapshot: profile,
          approvalStatus: COMPANY_APPROVAL_STATUS.APPROVED,
          operationalStatus: COMPANY_OPERATIONAL_STATUS.ACTIVE,
          submittedAt,
          reviewedByUserId: adminId,
          reviewedAt,
          activatedAt: now,
        }],
        { session },
      );
      await CompanyMember.create(
        [{
          _id: row.memberId,
          userId: row.userId,
          companyId: row.companyId,
          role: COMPANY_MEMBER_ROLE.COMPANY_MANAGER,
          status: COMPANY_MEMBER_STATUS.ACTIVE,
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
  const definitions = await loadDefinitions();
  let connected = false;
  try {
    const connection = await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);
    connected = true;
    if (connection.name !== EXPECTED_DATABASE) {
      throw new Error("Connected database guard failed");
    }

    const admin = await User.findOne({
      email: config.admin.email,
      role: USER_ROLE.PLATFORM_ADMIN,
      status: USER_STATUS.ACTIVE,
      emailVerifiedAt: { $ne: null },
    }).select("_id");
    if (!admin) throw new Error("Active Platform Admin is required");

    const fieldNames = new Set(
      (await Category.find({ level: "FIELD" }).select("name").lean()).map(
        (field) => field.name,
      ),
    );
    if (
      fieldNames.size !== 25 ||
      definitions.some((row) => !fieldNames.has(row.field))
    ) {
      throw new Error("Production FIELD catalog does not match Company dataset");
    }

    const before = await inspectExisting(definitions, admin._id);
    const report = {
      target: `${EXPECTED_HOST}/${EXPECTED_DATABASE}`,
      mode: apply ? "apply" : "dry-run",
      companies: 50,
      managers: 50,
      fieldsCovered: 25,
      itCompanies: 6,
      existing: before.complete,
      missing: before.missing,
    };
    if (!apply) return report;

    await ensureCompanyCollectionInvariants(connection);
    await Promise.all([
      User.createIndexes(),
      Company.createIndexes(),
      CompanyMember.createIndexes(),
    ]);

    for (const row of definitions) {
      if (
        await Company.exists({ _id: row.companyId })
      ) continue;
      await createOne(row, admin._id);
    }

    const after = await inspectExisting(definitions, admin._id);
    if (after.complete !== 50 || after.missing !== 0) {
      throw new Error("Production Company seed verification failed");
    }
    return { ...report, created: after.complete - before.complete, verified: after.complete };
  } finally {
    if (connected) await disconnectDatabase();
  }
};

const args = process.argv.slice(2);
if (args.length !== 1 || !["--dry-run", "--apply"].includes(args[0])) {
  process.stderr.write(
    "Usage: node scripts/seed-production-companies.js --dry-run|--apply\n",
  );
  process.exitCode = 2;
} else {
  try {
    process.stdout.write(`${JSON.stringify(await run(args[0] === "--apply"), null, 2)}\n`);
  } catch {
    // Database driver errors may contain credentials; keep diagnostics generic.
    process.stderr.write(
      "Production Company seed failed. Check local data and rerun dry-run before retrying.\n",
    );
    process.exitCode = 1;
  }
}
