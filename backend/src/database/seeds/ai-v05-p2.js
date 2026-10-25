import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import config from "../../config/index.js";
import { connectDatabase, disconnectDatabase, MODEL_AUTO_INIT_DISABLED_OPTIONS } from "../../config/mongodb.js";
import Category from "../../models/category.model.js";
import Company from "../../models/company.model.js";
import CompanyMember from "../../models/company-member.model.js";
import User from "../../models/user.model.js";
import Job, { assertJobCollectionInvariantsActive } from "../../models/job.model.js";
import CandidateCV from "../../models/candidate-cv.model.js";
import ExperienceLevel from "../../models/experience-level.model.js";
import { createPositionCategory } from "../../services/category.service.js";
import { createDraftJob, submitDraftJob, approveAndPublishJob } from "../../services/job.service.js";
import { createGeneratedDraftCandidateCv, saveOwnGeneratedContent, activateOwnGeneratedCandidateCv, setOwnCandidateCvAsDefault } from "../../services/candidate-cv.service.js";
import { validateLocation } from "../../services/location.service.js";
import { loadPublicJobDiscoverySource } from "../../services/job-discovery.service.js";
import { normalizeCandidateVisibleJob } from "../../services/job-ai-normalization.service.js";
import { normalizeOwnGeneratedCandidateCv } from "../../services/candidate-cv-ai-normalization.service.js";
import { COMPANY_IDS, FIELDS, SEED_NAMESPACE, SENIORITIES } from "./ai-v05-p2-data.js";

const MANIFEST_PATH = fileURLToPath(new URL("../../../.seed-manifests/ai-v05-p2.json", import.meta.url));
const DATABASE_NAME = "jobhub";
const id = (value) => value?.toString() ?? null;
const fixtureId = (key) => new mongoose.Types.ObjectId(createHash("sha256").update(`${SEED_NAMESPACE}:${key}`).digest("hex").slice(0, 24));
const seedEmail = (kind, number) => `ai-v05-p2-${kind}-${String(number).padStart(2, "0")}@seed.jobhub.invalid`;
const roles = FIELDS.flatMap((field, fieldIndex) => field.positions.map((position, positionIndex) => ({ field, position, fieldIndex, positionIndex, roleIndex: fieldIndex * 3 + positionIndex })));
const jobs = roles.flatMap((role) => SENIORITIES.map((seniority, levelIndex) => ({ ...role, seniority, levelIndex, index: role.roleIndex * 4 + levelIndex, key: `job-${String(role.roleIndex * 4 + levelIndex + 1).padStart(2, "0")}`, title: `[AI-V05-P2] ${seniority.title} ${role.position.name} — ${role.position.project}` })));
const cvs = Array.from({ length: 18 }, (_, index) => {
  const target = roles[index % 15];
  const tier = ["HIGH", "MEDIUM", "LOW"][Math.floor(index / 6)];
  const source = tier === "HIGH" ? target : tier === "MEDIUM" ? roles[target.fieldIndex * 3 + (target.positionIndex + 1) % 3] : roles[(target.roleIndex + 6) % 15];
  return { index, key: `cv-${String(index + 1).padStart(2, "0")}`, email: seedEmail("candidate", index + 1), name: `[AI-V05-P2] ${source.position.name} CV ${String(index + 1).padStart(2, "0")}`, source, targetJobKey: `job-${String(target.roleIndex * 4 + 2).padStart(2, "0")}`, tier };
});

const newManifest = () => ({ version: 1, namespace: SEED_NAMESPACE, database: DATABASE_NAME, reused: { companies: COMPANY_IDS, recruiters: {}, categories: {} }, pending: { categories: {}, jobs: {}, cvs: {} }, created: { categories: {}, recruiterUsers: {}, recruiterMembers: {}, candidateUsers: {}, jobs: {}, cvs: {} }, cvMatchCases: Object.fromEntries(cvs.map((cv) => [cv.key, { tier: cv.tier, targetJobKey: cv.targetJobKey }])) });
const loadManifest = async () => {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
    if (manifest.version !== 1 || manifest.namespace !== SEED_NAMESPACE || manifest.database !== DATABASE_NAME || !manifest.pending || !manifest.created) throw new Error("Seed manifest identity mismatch");
    return manifest;
  } catch (error) {
    if (error.code === "ENOENT") return newManifest();
    throw error;
  }
};
const saveManifest = async (manifest) => {
  await mkdir(dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(`${MANIFEST_PATH}.tmp`, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await rename(`${MANIFEST_PATH}.tmp`, MANIFEST_PATH);
};
const remember = async (manifest, type, key, objectId) => {
  const previous = manifest.created[type][key];
  if (previous && previous !== id(objectId)) throw new Error(`Manifest drift: ${type}/${key}`);
  if (!previous) manifest.created[type][key] = id(objectId);
  if (manifest.pending[type]) delete manifest.pending[type][key];
  await saveManifest(manifest);
};
const markPending = async (manifest, type, key) => {
  if (!manifest.pending[type][key]) {
    manifest.pending[type][key] = true;
    await saveManifest(manifest);
  }
};
const eligible = (user, member) => user?.role === "COMPANY_STAFF" && user.status === "ACTIVE" && user.emailVerifiedAt != null && user.mustChangePassword === false && member?.status === "ACTIVE";

const inspectCompanies = async () => {
  const result = [];
  for (const companyId of COMPANY_IDS) {
    const company = await Company.findById(companyId);
    if (!company || company.approvalStatus !== "APPROVED" || company.operationalStatus !== "ACTIVE") throw new Error(`Company ${companyId} is not APPROVED/ACTIVE`);
    const managerMember = await CompanyMember.findOne({ companyId, role: "COMPANY_MANAGER" });
    const manager = managerMember && await User.findById(managerMember.userId);
    if (!eligible(manager, managerMember)) throw new Error(`Company ${companyId} has no eligible Manager`);
    const recruiterMembers = await CompanyMember.find({ companyId, role: "RECRUITER", status: "ACTIVE" }).sort({ _id: 1 });
    const recruiters = [];
    for (const member of recruiterMembers) {
      const user = await User.findById(member.userId);
      if (eligible(user, member)) recruiters.push({ member, user });
    }
    result.push({ company, manager, recruiters });
  }
  return result;
};
const inspectTaxonomy = async () => {
  const fields = [];
  for (const definition of FIELDS) {
    const field = await Category.findOne({ level: "FIELD", parentCategoryId: null, normalizedName: definition.name.toLowerCase() });
    if (!field) throw new Error(`Missing agreed FIELD: ${definition.name}`);
    fields.push(field);
  }
  const levels = new Map((await ExperienceLevel.find({})).map((level) => [level.code, level]));
  for (const seniority of SENIORITIES) if (!levels.has(seniority.experience)) throw new Error(`Missing ExperienceLevel ${seniority.experience}`);
  return { fields, levels };
};
const positionKey = (role) => `position-${String(role.roleIndex + 1).padStart(2, "0")}`;
const findPosition = (role, taxonomy) => Category.findOne({ level: "POSITION", parentCategoryId: taxonomy.fields[role.fieldIndex]._id, normalizedName: role.position.name.toLowerCase() });

const assertFixtureUser = async (key, email, role) => {
  const expectedId = fixtureId(key);
  const [byId, byEmail] = await Promise.all([User.findById(expectedId), User.findOne({ email })]);
  if (byId && byId.email !== email) throw new Error(`Fixture ID collision for ${key}`);
  if (byEmail && id(byEmail._id) !== id(expectedId)) throw new Error(`Seed email collision: ${email}`);
  if (byId && (byId.role !== role || byId.status !== "ACTIVE" || byId.emailVerifiedAt == null || byId.mustChangePassword !== false)) throw new Error(`Fixture account drift: ${key}`);
  return byId;
};
const ensureFixtureUser = async (key, email, name, role, manifest, collection) => {
  let user = await assertFixtureUser(key, email, role);
  if (!user) user = await User.create({ _id: fixtureId(key), fullName: name, email, passwordHash: await bcrypt.hash(randomBytes(48).toString("hex"), config.bcrypt.saltRounds), role, status: "ACTIVE", emailVerifiedAt: new Date(), mustChangePassword: false });
  await remember(manifest, collection, key, user._id);
  return user;
};
const ensureRecruiter = async (context, companyIndex, manifest) => {
  if (context.recruiters.length) {
    manifest.reused.recruiters[id(context.company._id)] = context.recruiters.map(({ member }) => id(member._id));
    await saveManifest(manifest);
    return;
  }
  const key = `recruiter-${companyIndex + 1}`;
  const user = await ensureFixtureUser(key, seedEmail("recruiter", companyIndex + 1), `AI V05 P2 Recruiter ${companyIndex + 1}`, "COMPANY_STAFF", manifest, "recruiterUsers");
  const memberId = fixtureId(`${key}-membership`);
  let member = await CompanyMember.findById(memberId);
  if (!member) {
    if (await CompanyMember.exists({ userId: user._id })) throw new Error(`Fixture User ${key} already has another membership`);
    member = await CompanyMember.create({ _id: memberId, userId: user._id, companyId: context.company._id, role: "RECRUITER", status: "ACTIVE", employeeCode: `AIV05P2-${companyIndex + 1}`, jobTitle: "Recruitment Specialist" });
  }
  if (id(member.userId) !== id(user._id) || id(member.companyId) !== id(context.company._id) || member.role !== "RECRUITER" || member.status !== "ACTIVE") throw new Error(`Fixture membership drift: ${key}`);
  await remember(manifest, "recruiterMembers", key, member._id);
  context.recruiters.push({ member, user });
};
const ensurePositions = async (taxonomy, manifest) => {
  const positions = new Map();
  for (const role of roles) {
    const key = positionKey(role);
    let position = await findPosition(role, taxonomy);
    if (!position) {
      await markPending(manifest, "categories", key);
      const result = await createPositionCategory({ name: role.position.name, parentCategoryId: taxonomy.fields[role.fieldIndex]._id });
      position = await Category.findById(result.id);
      await remember(manifest, "categories", key, position._id);
    } else if (manifest.created.categories[key] || manifest.pending.categories[key]) {
      await remember(manifest, "categories", key, position._id);
    } else {
      manifest.reused.categories[key] = id(position._id);
    }
    positions.set(role.roleIndex, position);
  }
  await saveManifest(manifest);
  return positions;
};
const jobContent = (job, taxonomy, positions, now) => ({
  title: job.title,
  jobDescription: `${job.position.work}. ${job.seniority.scope}. Work on ${job.position.project.toLowerCase()}. Deliver documented results, collaborate with stakeholders, and review quality with the team.`,
  requiredSkills: job.position.skills.slice(0, job.levelIndex === 0 ? 3 : job.levelIndex === 1 ? 4 : 5),
  salary: { type: "RANGE", minAmount: job.seniority.salaryMin + job.fieldIndex * 1000000, maxAmount: job.seniority.salaryMax + job.fieldIndex * 1000000, period: "MONTH", customPeriodLabel: null },
  fieldCategoryIds: [taxonomy.fields[job.fieldIndex]._id],
  positionCategoryIds: [positions.get(job.roleIndex)._id],
  location: { provinceCode: ["1", "79", "48"][job.roleIndex % 3], districtCode: null },
  employmentType: job.levelIndex === 1 && job.roleIndex % 4 === 0 ? "CONTRACT" : "FULL_TIME",
  workModes: [["ONSITE"], ["HYBRID"], ["HYBRID", "REMOTE"], ["ONSITE", "HYBRID"]][job.levelIndex],
  experienceLevelId: taxonomy.levels.get(job.seniority.experience)._id,
  applicationDeadline: new Date(now.getTime() + (180 + job.levelIndex * 30) * 86400000),
});
const ensureJob = async (definition, contexts, taxonomy, positions, manifest, now) => {
  const context = contexts[definition.index % 6];
  const companyJobIndex = Math.floor(definition.index / 6);
  const recruiter = context.recruiters[companyJobIndex % context.recruiters.length];
  const matches = await Job.find({ title: definition.title, companyId: context.company._id });
  if (matches.length > 1) throw new Error(`Duplicate seed Job title: ${definition.title}`);
  let job = matches[0];
  if (job && !manifest.created.jobs[definition.key] && !manifest.pending.jobs[definition.key]) throw new Error(`Unowned Job with seed title: ${definition.title}`);
  if (!job) {
    await markPending(manifest, "jobs", definition.key);
    const created = await createDraftJob({ recruiterUser: recruiter.user, content: jobContent(definition, taxonomy, positions, now) });
    job = await Job.findById(created.id);
  }
  await remember(manifest, "jobs", definition.key, job._id);
  if (id(job.companyId) !== id(context.company._id) || id(job.createdByCompanyMemberId) !== id(recruiter.member._id) || id(job.primaryRecruiterCompanyMemberId) !== id(recruiter.member._id)) throw new Error(`Job ownership drift: ${definition.key}`);
  if (job.status === "DRAFT") { await submitDraftJob({ recruiterUser: recruiter.user, jobId: job._id }); job = await Job.findById(job._id); }
  if (job.status === "PENDING_APPROVAL") { await approveAndPublishJob({ managerUser: context.manager, jobId: job._id }); job = await Job.findById(job._id); }
  if (job.status !== "PUBLISHED" || !(job.applicationDeadline > now)) throw new Error(`Job ${definition.key} is not effectively PUBLISHED`);
};
const cvContent = (definition) => {
  const position = definition.source.position;
  const skills = position.skills.slice(0, definition.tier === "MEDIUM" ? 4 : 5);
  return {
    personalInfo: { fullName: `AI V05 P2 Candidate ${definition.index + 1}`, email: definition.email, phone: `0908${String(definition.index + 1).padStart(6, "0")}`, displayLocation: "Vietnam", links: [] },
    professionalSummary: `${position.name} with practical experience in ${skills.slice(0, 3).join(", ")}. Focused on ${position.work.toLowerCase()}.`,
    educations: [{ institutionName: "University of Technology and Management", degree: "Bachelor's degree", fieldOfStudy: definition.source.field.name, startDate: new Date("2018-09-01"), endDate: new Date("2022-06-30") }],
    skills,
    workExperiences: [{ companyName: "Regional Product and Operations Group", position: position.name, startDate: new Date("2022-07-01"), endDate: new Date("2025-12-31"), description: position.work, achievements: [`Delivered ${position.project.toLowerCase()} with documented outcomes and team review.`] }],
    projects: [{ name: position.project, role: position.name, technologies: skills.slice(0, 3), description: `Contributed to ${position.project.toLowerCase()} using ${skills.slice(0, 3).join(", ")}.` }],
    certifications: [], languages: [{ name: "English", proficiency: "INTERMEDIATE" }], hiddenSections: [],
  };
};
const ensureCv = async (definition, positions, taxonomy, manifest) => {
  const key = `candidate-${definition.index + 1}`;
  const user = await ensureFixtureUser(key, definition.email, `AI V05 P2 Candidate ${definition.index + 1}`, "CANDIDATE", manifest, "candidateUsers");
  const matches = await CandidateCV.find({ candidateUserId: user._id, name: definition.name });
  if (matches.length > 1) throw new Error(`Duplicate seed CV name: ${definition.name}`);
  let cv = matches[0];
  if (cv && !manifest.created.cvs[definition.key] && !manifest.pending.cvs[definition.key]) throw new Error(`Unowned CV with seed name: ${definition.name}`);
  if (!cv) {
    await markPending(manifest, "cvs", definition.key);
    const created = await createGeneratedDraftCandidateCv({ candidateUserId: user._id, actorUser: user, draft: { name: definition.name, visibility: "PUBLIC", categoryId: positions.get(definition.source.roleIndex)._id, experienceLevelId: taxonomy.levels.get("ONE_TO_THREE_YEARS")._id, skillTags: definition.source.position.skills.slice(0, 4), preferredLocations: [], employmentTypes: ["FULL_TIME"], workModes: ["HYBRID"] } });
    cv = await CandidateCV.findById(created.id);
  }
  await remember(manifest, "cvs", definition.key, cv._id);
  if (id(cv.candidateUserId) !== id(user._id) || cv.sourceType !== "GENERATED" || cv.archivedAt != null || id(cv.categoryId) !== id(positions.get(definition.source.roleIndex)._id)) throw new Error(`CV ownership or category drift: ${definition.key}`);
  if (cv.status === "DRAFT") {
    const saved = await saveOwnGeneratedContent({ candidateUserId: user._id, actorUser: user, candidateCvId: cv._id, generatedContent: cvContent(definition) });
    if (!saved.completeness.isComplete) throw new Error(`Generated CV incomplete: ${definition.key}`);
    await activateOwnGeneratedCandidateCv({ candidateUserId: user._id, actorUser: user, candidateCvId: cv._id });
    cv = await CandidateCV.findById(cv._id);
  }
  if (cv.status !== "ACTIVE") throw new Error(`CV not ACTIVE: ${definition.key}`);
  if (!cv.isDefault) await setOwnCandidateCvAsDefault({ candidateUserId: user._id, actorUser: user, candidateCvId: cv._id });
};
const verify = async (manifest, contexts) => {
  const failures = [];
  const perCompany = Object.fromEntries(COMPANY_IDS.map((companyId) => [companyId, 0]));
  let discoverable = 0, jobNormalizationReady = 0, defaultGeneratedCvs = 0, cvNormalizationReady = 0;
  for (const definition of jobs) {
    const jobId = manifest.created.jobs[definition.key];
    const job = jobId && await Job.findById(jobId);
    if (!job) { failures.push(`Missing ${definition.key}`); continue; }
    const context = contexts.find((entry) => id(entry.company._id) === id(job.companyId));
    const primary = await CompanyMember.findById(job.primaryRecruiterCompanyMemberId);
    const primaryUser = primary && await User.findById(primary.userId);
    if (!context || primary?.role !== "RECRUITER" || id(primary.companyId) !== id(job.companyId) || !eligible(primaryUser, primary)) { failures.push(`Invalid Primary ${definition.key}`); continue; }
    perCompany[id(job.companyId)]++;
    try {
      await loadPublicJobDiscoverySource({ actorUser: null, jobId: job._id });
      discoverable++;
      const normalized = await normalizeCandidateVisibleJob({ actorUser: null, jobId: job._id });
      if (normalized.status === "READY") jobNormalizationReady++; else failures.push(`Job normalization ${definition.key}: ${normalized.status}`);
    } catch (error) { failures.push(`Job ${definition.key}: ${error.message}`); }
  }
  for (const definition of cvs) {
    const cvId = manifest.created.cvs[definition.key];
    const cv = cvId && await CandidateCV.findById(cvId);
    const user = cv && await User.findById(cv.candidateUserId);
    if (!cv || !user || cv.sourceType !== "GENERATED" || cv.status !== "ACTIVE" || cv.archivedAt != null || cv.isDefault !== true) { failures.push(`Invalid Default Generated ${definition.key}`); continue; }
    defaultGeneratedCvs++;
    try {
      const normalized = await normalizeOwnGeneratedCandidateCv({ candidateUserId: user._id, actorUser: user, candidateCvId: cv._id });
      if (normalized.status === "READY") cvNormalizationReady++; else failures.push(`CV normalization ${definition.key}: ${normalized.status}`);
    } catch (error) { failures.push(`CV ${definition.key}: ${error.message}`); }
  }
  for (const [companyId, count] of Object.entries(perCompany)) if (count !== 10) failures.push(`Company ${companyId}: ${count}/10 Jobs`);
  if (discoverable !== 60) failures.push(`Discoverable: ${discoverable}/60`);
  if (jobNormalizationReady !== 60) failures.push(`Job V01 READY: ${jobNormalizationReady}/60`);
  if (defaultGeneratedCvs !== 18) failures.push(`Default Generated CV: ${defaultGeneratedCvs}/18`);
  if (cvNormalizationReady !== 18) failures.push(`CV V01 READY: ${cvNormalizationReady}/18`);
  return { discoverable, jobNormalizationReady, defaultGeneratedCvs, cvNormalizationReady, perCompany, failures };
};
const inventory = async (contexts, taxonomy, manifest) => {
  let missingPositions = 0;
  for (const role of roles) if (!(await findPosition(role, taxonomy))) missingPositions++;
  return { database: DATABASE_NAME, manifest: MANIFEST_PATH, expected: { companies: 6, positions: 15, jobs: 60, candidateUsers: 18, defaultGeneratedCvs: 18 }, current: { missingPositions, companiesWithoutRecruiter: contexts.filter((context) => !context.recruiters.length).map((context) => ({ id: id(context.company._id), name: context.company.name })), manifestCounts: Object.fromEntries(Object.entries(manifest.created).map(([key, value]) => [key, Object.keys(value).length])) } };
};

const runAiV05P2Seed = async ({ apply = false } = {}) => {
  await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);
  try {
    if (config.env !== "development" || mongoose.connection.db?.databaseName !== DATABASE_NAME) throw new Error("Seeder is restricted to NODE_ENV=development and MongoDB jobhub");
    await assertJobCollectionInvariantsActive();
    const manifest = await loadManifest();
    const contexts = await inspectCompanies();
    const taxonomy = await inspectTaxonomy();
    const preflight = await inventory(contexts, taxonomy, manifest);
    if (!apply) return { mode: "dry-run", ...preflight };
    const admins = await User.countDocuments({ role: "PLATFORM_ADMIN", status: "ACTIVE", emailVerifiedAt: { $ne: null } });
    if (!admins) throw new Error("No active verified Platform Admin for Category provisioning");
    for (const provinceCode of ["1", "79", "48"]) await validateLocation({ provinceCode });
    await saveManifest(manifest);
    const positions = await ensurePositions(taxonomy, manifest);
    for (let index = 0; index < contexts.length; index++) await ensureRecruiter(contexts[index], index, manifest);
    const now = new Date();
    for (const job of jobs) await ensureJob(job, contexts, taxonomy, positions, manifest, now);
    for (const cv of cvs) await ensureCv(cv, positions, taxonomy, manifest);
    return { mode: "apply", preflight, verification: await verify(manifest, contexts) };
  } finally {
    await disconnectDatabase();
  }
};

export { runAiV05P2Seed, roles, jobs, cvs, fixtureId };
