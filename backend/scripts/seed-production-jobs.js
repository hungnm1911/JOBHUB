import { createHash } from "node:crypto";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import config from "../src/config/index.js";
import {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
} from "../src/config/mongodb.js";
import COMPANY_MEMBER_ROLE from "../src/constants/company-member-role.js";
import COMPANY_MEMBER_STATUS from "../src/constants/company-member-status.js";
import COMPANY_APPROVAL_STATUS from "../src/constants/company-approval-status.js";
import COMPANY_OPERATIONAL_STATUS from "../src/constants/company-operational-status.js";
import JOB_STATUS from "../src/constants/job-status.js";
import USER_STATUS from "../src/constants/user-status.js";
import Category from "../src/models/category.model.js";
import Company from "../src/models/company.model.js";
import CompanyMember from "../src/models/company-member.model.js";
import ExperienceLevel from "../src/models/experience-level.model.js";
import Job, {
  getJobSalaryInvariantErrors,
  isJobCollectionValidatorActive,
} from "../src/models/job.model.js";
import User from "../src/models/user.model.js";
import { listProvinces } from "../src/services/location.service.js";
import { normalizeRichText } from "../src/services/rich-text.service.js";
import {
  addSupportingRecruiter,
  approveAndPublishJob,
  createDraftJob,
  submitDraftJob,
} from "../src/services/job.service.js";

const HOST = "jobhub-prod.a956r7b.mongodb.net";
const DATABASE = "jobhub";
const DATA_URL = new URL(
  "../../tmp/production-seed-data/seed-normaliztion/production-jobs.json",
  import.meta.url,
);
const STATE_URL = new URL(
  "../../tmp/production-seed-data/seed-normaliztion/production-jobs-state.json",
  import.meta.url,
);
const id = (value) => value?.toString();
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

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

const loadData = async () => {
  const fileStat = await stat(DATA_URL);
  if ((fileStat.mode & 0o077) !== 0) {
    throw new Error("Production Job JSON must be owner-only (chmod 600)");
  }
  const raw = await readFile(DATA_URL, "utf8");
  const data = JSON.parse(raw);
  if (
    data.version !== 1 ||
    data.namespace !== "jobhub-production-jobs-v1" ||
    !Array.isArray(data.companies) ||
    data.companies.length !== 50
  ) {
    throw new Error("Production Job seed identity/count mismatch");
  }
  const keys = new Set();
  const sourceRows = new Set();
  const companyNumbers = new Set();
  const jobs = [];
  for (const group of data.companies) {
    if (
      !group.company?.key ||
      !group.company?.businessRegistrationNumber ||
      companyNumbers.has(group.company.businessRegistrationNumber) ||
      !Array.isArray(group.jobs) ||
      group.jobs.length !== 10
    ) {
      throw new Error("Invalid Company group in Job seed");
    }
    companyNumbers.add(group.company.businessRegistrationNumber);
    for (const job of group.jobs) {
      const team = job.recruitmentTeam;
      if (
        !job.key ||
        keys.has(job.key) ||
        job.company?.key !== group.company.key ||
        job.company?.businessRegistrationNumber !==
          group.company.businessRegistrationNumber ||
        !Number.isInteger(job.source?.row) ||
        sourceRows.has(job.source.row) ||
        !team?.primary?.email ||
        !Array.isArray(team.supporting) ||
        team.supporting.length !== 2 ||
        new Set([team.primary.key, ...team.supporting.map((x) => x.key)]).size !== 3 ||
        !job.content?.title ||
        !job.content?.fieldCategoryName ||
        !job.content?.positionCategoryName ||
        !job.content?.jobDescriptionHtml ||
        !Array.isArray(job.content.requiredSkills) ||
        job.content.requiredSkills.length < 2 ||
        getJobSalaryInvariantErrors(job.content.salary).length > 0 ||
        new Date(job.content.applicationDeadline) <= new Date()
      ) {
        throw new Error("Invalid or duplicate Job seed definition");
      }
      keys.add(job.key);
      sourceRows.add(job.source.row);
      jobs.push(job);
    }
  }
  if (jobs.length !== 500) throw new Error("Expected exactly 500 Jobs");
  return { data, jobs, hash: createHash("sha256").update(raw).digest("hex") };
};

const readState = async (hash) => {
  let raw;
  try {
    const fileStat = await stat(STATE_URL);
    if ((fileStat.mode & 0o077) !== 0) {
      throw new Error("Production Job state must be owner-only");
    }
    raw = await readFile(STATE_URL, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, hash, jobs: {} };
    throw error;
  }
  const state = JSON.parse(raw);
  if (state.version !== 1 || state.hash !== hash || !state.jobs) {
    throw new Error("Job seed changed after a previous run");
  }
  return state;
};

const saveState = async (state) => {
  const temporary = new URL(`${STATE_URL.pathname}.tmp`, STATE_URL);
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, STATE_URL);
};

const loadTargets = async (data, jobs) => {
  const registrations = data.companies.map(
    (group) => group.company.businessRegistrationNumber,
  );
  const [companies, categories, experienceLevels, provinces] = await Promise.all([
    Company.find({ businessRegistrationNumber: { $in: registrations } }).lean(),
    Category.find({}).lean(),
    ExperienceLevel.find({}).lean(),
    listProvinces(),
  ]);
  if (companies.length !== 50 || experienceLevels.length !== 6) {
    throw new Error("Production Company or Experience catalog incomplete");
  }
  const companyByNumber = new Map(
    companies.map((company) => [company.businessRegistrationNumber, company]),
  );
  const categoryById = new Map(categories.map((category) => [id(category._id), category]));
  const fieldByName = new Map(
    categories.filter((category) => category.level === "FIELD").map((category) => [category.name, category]),
  );
  const experienceByCode = new Map(
    experienceLevels.map((level) => [level.code, level]),
  );
  const provinceCodes = new Set(provinces.map((province) => province.code));
  const members = await CompanyMember.find({
    companyId: { $in: companies.map((company) => company._id) },
  }).lean();
  const users = await User.find({ _id: { $in: members.map((member) => member.userId) } }).lean();
  const userById = new Map(users.map((user) => [id(user._id), user]));
  const memberByCompanyAndEmail = new Map();
  const managerByCompany = new Map();
  for (const member of members) {
    const user = userById.get(id(member.userId));
    if (
      !user ||
      user.status !== USER_STATUS.ACTIVE ||
      !user.emailVerifiedAt ||
      user.mustChangePassword !== false ||
      member.status !== COMPANY_MEMBER_STATUS.ACTIVE
    ) continue;
    const key = `${id(member.companyId)}:${user.email}`;
    memberByCompanyAndEmail.set(key, { member, user });
    if (member.role === COMPANY_MEMBER_ROLE.COMPANY_MANAGER) {
      if (managerByCompany.has(id(member.companyId))) {
        throw new Error("Company has multiple active Managers");
      }
      managerByCompany.set(id(member.companyId), user);
    }
  }
  const targets = new Map();
  for (const job of jobs) {
    const company = companyByNumber.get(job.company.businessRegistrationNumber);
    if (
      !company || company.name !== job.company.name ||
      company.approvalStatus !== COMPANY_APPROVAL_STATUS.APPROVED ||
      company.operationalStatus !== COMPANY_OPERATIONAL_STATUS.ACTIVE
    ) throw new Error("Production Company not approved/active");
    const companyId = id(company._id);
    const managerUser = managerByCompany.get(companyId);
    if (!managerUser) throw new Error("Production Company Manager missing");
    const team = [job.recruitmentTeam.primary, ...job.recruitmentTeam.supporting].map(
      (person) => memberByCompanyAndEmail.get(`${companyId}:${person.email}`),
    );
    if (team.some((entry) => !entry || entry.member.role !== COMPANY_MEMBER_ROLE.RECRUITER)) {
      throw new Error("Recruitment team missing or inactive");
    }
    const field = fieldByName.get(job.content.fieldCategoryName);
    const position = categories.find(
      (category) => category.level === "POSITION" &&
        category.name === job.content.positionCategoryName &&
        id(category.parentCategoryId) === id(field?._id),
    );
    const experience = experienceByCode.get(job.content.experienceCode);
    if (
      !field || !position || !categoryById.has(id(position._id)) || !experience ||
      !provinceCodes.has(job.content.location?.provinceCode)
    ) throw new Error("Job catalog or location mapping missing");
    const richText = normalizeRichText(job.content.jobDescriptionHtml, "full");
    if (!richText.html || !richText.text || richText.text.length < 100) {
      throw new Error("Job rich text invalid");
    }
    targets.set(job.key, {
      company,
      managerUser,
      team,
      content: {
        title: job.content.title,
        jobDescriptionHtml: richText.html,
        jobDescription: richText.text,
        requiredSkills: job.content.requiredSkills,
        salary: job.content.salary,
        fieldCategoryIds: [field._id],
        positionCategoryIds: [position._id],
        location: job.content.location,
        employmentType: job.content.employmentType,
        workModes: job.content.workModes,
        experienceLevelId: experience._id,
        applicationDeadline: job.content.applicationDeadline,
      },
    });
  }
  return targets;
};

const assertMatchesDefinition = (document, target) => {
  const content = target.content;
  if (
    id(document.companyId) !== id(target.company._id) ||
    id(document.primaryRecruiterCompanyMemberId) !== id(target.team[0].member._id) ||
    id(document.createdByCompanyMemberId) !== id(target.team[0].member._id) ||
    document.title !== content.title ||
    document.jobDescriptionHtml !== content.jobDescriptionHtml ||
    document.jobDescription !== content.jobDescription ||
    !equal(document.requiredSkills, content.requiredSkills) ||
    !equal([document.salary?.type, document.salary?.minAmount ?? null, document.salary?.maxAmount ?? null, document.salary?.period ?? null], [content.salary.type, content.salary.minAmount, content.salary.maxAmount, content.salary.period]) ||
    !equal(document.fieldCategoryIds.map(id), content.fieldCategoryIds.map(id)) ||
    !equal(document.positionCategoryIds.map(id), content.positionCategoryIds.map(id)) ||
    !equal([document.location?.provinceCode, document.location?.districtCode ?? null], [content.location.provinceCode, content.location.districtCode ?? null]) ||
    document.employmentType !== content.employmentType ||
    !equal(document.workModes, content.workModes) ||
    id(document.experienceLevelId) !== id(content.experienceLevelId) ||
    new Date(document.applicationDeadline).getTime() !== new Date(content.applicationDeadline).getTime()
  ) throw new Error("Existing Job differs from normalized seed");
  const expectedSupport = target.team.slice(1).map((entry) => id(entry.member._id));
  const actualSupport = (document.supportingRecruiterCompanyMemberIds ?? []).map(id);
  if (actualSupport.some((memberId) => !expectedSupport.includes(memberId))) {
    throw new Error("Existing Job has foreign Supporting Recruiter");
  }
};

const findExisting = (job, target, existing, state) => {
  const stateId = state.jobs[job.key];
  const matches = existing.filter(
    (document) => id(document.companyId) === id(target.company._id) &&
      document.title === job.content.title &&
      document.jobDescriptionHtml === target.content.jobDescriptionHtml,
  );
  if (matches.length > 1 || (stateId && matches.length === 0)) {
    throw new Error("Job seed state or title collision");
  }
  const document = matches[0] ?? null;
  if (stateId && id(document?._id) !== stateId) {
    throw new Error("Job seed manifest ID mismatch");
  }
  if (document) assertMatchesDefinition(document, target);
  return document;
};

const run = async (apply) => {
  assertProductionTarget();
  const { data, jobs, hash } = await loadData();
  const state = await readState(hash);
  let connected = false;
  try {
    const connection = await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);
    connected = true;
    if (connection.name !== DATABASE || !(await isJobCollectionValidatorActive(connection))) {
      throw new Error("Production database or strict Job validator guard failed");
    }
    const targets = await loadTargets(data, jobs);
    const companyIds = [...targets.values()].map((target) => target.company._id);
    const existing = await Job.find({ companyId: { $in: companyIds } }).lean();
    const matched = new Set();
    for (const job of jobs) {
      const document = findExisting(job, targets.get(job.key), existing, state);
      if (document) matched.add(id(document._id));
    }
    if (matched.size !== existing.length) {
      throw new Error("Unexpected existing Job in seeded Company");
    }
    const report = {
      target: `${HOST}/${DATABASE}`,
      mode: apply ? "apply" : "dry-run",
      companies: 50,
      expectedJobs: 500,
      existing: matched.size,
      missing: 500 - matched.size,
      published: existing.filter((document) => document.status === JOB_STATUS.PUBLISHED).length,
    };
    if (!apply) return report;

    let created = 0;
    let completed = 0;
    let cursor = 0;
    let failure = null;
    let stateWrite = Promise.resolve();
    const recordState = (key, jobId) => {
      state.jobs[key] = jobId;
      stateWrite = stateWrite.then(() => saveState(state));
      return stateWrite;
    };
    const processOne = async (job) => {
      const target = targets.get(job.key);
      let document = findExisting(job, target, existing, state);
      if (!document) {
        const createdJob = await createDraftJob({
          recruiterUser: target.team[0].user,
          content: target.content,
        });
        document = await Job.findById(createdJob.id).lean();
        assertMatchesDefinition(document, target);
        existing.push(document);
        await recordState(job.key, id(document._id));
        created += 1;
      } else if (!state.jobs[job.key]) {
        await recordState(job.key, id(document._id));
      }
      if (document.status === JOB_STATUS.DRAFT) {
        await submitDraftJob({ recruiterUser: target.team[0].user, jobId: id(document._id) });
        document = await Job.findById(document._id).lean();
      }
      if (document.status === JOB_STATUS.PENDING_APPROVAL) {
        await approveAndPublishJob({ managerUser: target.managerUser, jobId: id(document._id) });
        document = await Job.findById(document._id).lean();
      }
      if (document.status !== JOB_STATUS.PUBLISHED) {
        throw new Error("Job did not reach PUBLISHED");
      }
      for (const support of target.team.slice(1)) {
        if ((document.supportingRecruiterCompanyMemberIds ?? []).map(id).includes(id(support.member._id))) continue;
        await addSupportingRecruiter({
          actorUser: target.managerUser,
          jobId: id(document._id),
          supportingRecruiterCompanyMemberId: id(support.member._id),
        });
        document = await Job.findById(document._id).lean();
      }
      assertMatchesDefinition(document, target);
      if ((document.supportingRecruiterCompanyMemberIds ?? []).length !== 2) {
        throw new Error("Job recruitment team incomplete");
      }
      completed += 1;
      if (completed % 10 === 0) process.stdout.write(`Completed ${completed}/500 Jobs\n`);
    };
    const worker = async () => {
      while (!failure && cursor < jobs.length) {
        const job = jobs[cursor++];
        try {
          await processOne(job);
        } catch (error) {
          failure = error;
        }
      }
    };
    await Promise.all(Array.from({ length: 4 }, () => worker()));
    if (failure) throw failure;
    const after = await Job.find({ companyId: { $in: companyIds } }).lean();
    if (after.length !== 500 || after.some((job) => job.status !== JOB_STATUS.PUBLISHED)) {
      throw new Error("Final Job count/status verification failed");
    }
    return { ...report, created, verifiedPublished: after.length,
      withEmbeddingText: after.filter((job) => typeof job.embeddingText === "string" && job.embeddingText.trim()).length };
  } finally {
    if (connected) await disconnectDatabase();
  }
};

const args = process.argv.slice(2);
if (args.length !== 1 || !["--dry-run", "--apply"].includes(args[0])) {
  process.stderr.write("Usage: node scripts/seed-production-jobs.js --dry-run|--apply\n");
  process.exitCode = 2;
} else {
  try {
    process.stdout.write(`${JSON.stringify(await run(args[0] === "--apply"), null, 2)}\n`);
  } catch (error) {
    // Driver errors may include a URI. Keep diagnostic output credential-free.
    process.stderr.write(`Production Job seed failed (${error.name}). Inspect local data/state and retry dry-run.\n`);
    process.exitCode = 1;
  }
}
