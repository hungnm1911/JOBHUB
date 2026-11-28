import { readFile, stat } from "node:fs/promises";
import mongoose from "mongoose";

import config from "../src/config/index.js";
import {
  connectDatabase,
  disconnectDatabase,
  MODEL_AUTO_INIT_DISABLED_OPTIONS,
} from "../src/config/mongodb.js";
import CandidateCV, { ensureCandidateCvCollectionInvariants } from "../src/models/candidate-cv.model.js";
import Category from "../src/models/category.model.js";
import ExperienceLevel from "../src/models/experience-level.model.js";
import User from "../src/models/user.model.js";
import { listProvinces } from "../src/services/location.service.js";
import {
  createGeneratedDraftCandidateCv,
  evaluateGeneratedCvCompleteness,
  normalizeGeneratedContentForPersistence,
  saveOwnGeneratedContent,
  setOwnCandidateCvAsDefault,
} from "../src/services/candidate-cv.service.js";

const HOST = "jobhub-prod.a956r7b.mongodb.net";
const DATABASE = "jobhub";
const DATA_URL = new URL(
  "../../tmp/production-seed-data/seed-normaliztion/production-cvs.json",
  import.meta.url,
);
const EXPECTED_BANDS = Object.freeze({
  NO_EXPERIENCE: 21,
  UNDER_1_YEAR: 6,
  ONE_TO_THREE_YEARS: 106,
  THREE_TO_FIVE_YEARS: 45,
  FIVE_TO_TEN_YEARS: 21,
  OVER_TEN_YEARS: 1,
});
const id = (value) => value?.toString();
const words = (value) => value.trim().split(/\s+/u).length;
const seededYears = Object.freeze({
  NO_EXPERIENCE: 0,
  UNDER_1_YEAR: 0.5,
  ONE_TO_THREE_YEARS: 2,
  THREE_TO_FIVE_YEARS: 4,
  FIVE_TO_TEN_YEARS: 7,
  OVER_TEN_YEARS: 11,
});

const originalSeedSummary = (entry, cv) => {
  const role = cv.name.split(" — ")[0];
  const skills = cv.generatedContent.skills.slice(0, 3).join(", ");
  const years = seededYears[cv.experienceCode];
  if (years === 0) {
    return `Ứng viên định hướng phát triển trong lĩnh vực ${entry.fieldName}, quan tâm tới vai trò ${role}. Có nền tảng về ${skills} từ học tập và thực hành. Mong muốn tham gia môi trường có hướng dẫn rõ ràng để vận dụng kiến thức và phát triển kỹ năng chuyên môn.`;
  }
  return `Ứng viên theo đuổi vai trò ${role} trong lĩnh vực ${entry.fieldName}, có ${years < 1 ? "dưới một năm" : `khoảng ${years} năm`} kinh nghiệm. Trọng tâm chuyên môn gồm ${skills}. Ưu tiên công việc có mục tiêu rõ ràng, phối hợp tốt với đồng nghiệp và cải thiện chất lượng qua từng giai đoạn.`;
};

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
    throw new Error("CV data must be owner-only (chmod 600)");
  }
  const data = JSON.parse(await readFile(DATA_URL, "utf8"));
  if (
    data.version !== 1 ||
    data.namespace !== "jobhub-production-cvs-v1" ||
    !Array.isArray(data.groups) ||
    data.groups.length !== 25
  ) {
    throw new Error("CV data identity/count mismatch");
  }
  const entries = data.groups.flatMap((group) =>
    group.candidates.map((candidate) => ({ ...candidate, groupName: group.fieldName })),
  );
  const keys = new Set();
  const uuids = new Set();
  const cvKeys = new Set();
  const bands = Object.fromEntries(Object.keys(EXPECTED_BANDS).map((key) => [key, 0]));
  if (entries.length !== 200) throw new Error("Expected 200 Candidate CV owners");
  for (const [index, entry] of entries.entries()) {
    const expectedKey = `candidate-${String(index + 1).padStart(3, "0")}`;
    if (
      entry.candidateKey !== expectedKey ||
      entry.candidateEmail !== `ungvien${String(index + 1).padStart(3, "0")}@accounts.jobhub.invalid` ||
      entry.fieldName !== entry.groupName ||
      !entry.source?.uuid ||
      keys.has(entry.candidateKey) ||
      uuids.has(entry.source.uuid) ||
      !Array.isArray(entry.cvs) ||
      entry.cvs.length !== 2
    ) {
      throw new Error("Invalid Candidate CV owner or source");
    }
    keys.add(entry.candidateKey);
    uuids.add(entry.source.uuid);
    for (const [variant, cv] of entry.cvs.entries()) {
      if (
        cv.key !== `${entry.candidateKey}-cv-${String(variant + 1).padStart(2, "0")}` ||
        cvKeys.has(cv.key) ||
        cv.visibility !== "PUBLIC" ||
        cv.categoryName !== entry.fieldName ||
        cv.experienceCode !== entry.cvs[0].experienceCode ||
        !(cv.experienceCode in bands) ||
        !Array.isArray(cv.preferredLocations) ||
        cv.preferredLocations.length !== 1 ||
        !Array.isArray(cv.skillTags) ||
        cv.skillTags.length < 1
      ) {
        throw new Error("Invalid CV metadata or distribution");
      }
      cvKeys.add(cv.key);
      const normalized = normalizeGeneratedContentForPersistence(cv.generatedContent);
      if (!evaluateGeneratedCvCompleteness(normalized).isComplete) {
        throw new Error("Incomplete Generated CV");
      }
      if (
        normalized.personalInfo.email !== entry.candidateEmail ||
        !/^0000000\d{3}$/u.test(normalized.personalInfo.phone) ||
        normalized.projects.some((project) => {
          const count = words(project.description ?? "");
          return count < 120 || count > 150;
        })
      ) {
        throw new Error("Invalid CV content or project length");
      }
      for (const experience of normalized.workExperiences) {
        if (
          new Date(experience.startDate) > new Date("2026-11-28T23:59:59Z") ||
          (experience.endDate && new Date(experience.startDate) > new Date(experience.endDate))
        ) {
          throw new Error("Invalid work experience timeline");
        }
      }
    }
    bands[entry.cvs[0].experienceCode] += 1;
  }
  if (
    cvKeys.size !== 400 ||
    Object.keys(bands).some((code) => bands[code] !== EXPECTED_BANDS[code])
  ) {
    throw new Error("CV count or experience distribution mismatch");
  }
  return { entries, bands };
};

const assertExisting = (entry, existing, categories, levels) => {
  const expectedNames = new Set(entry.cvs.map((cv) => cv.name));
  if (existing.length > 2 || existing.some((cv) => !expectedNames.has(cv.name))) {
    throw new Error("Unexpected existing Candidate CV for seeded owner");
  }
  let summaryDrift = 0;
  for (const record of existing) {
    const source = entry.cvs.find((cv) => cv.name === record.name);
    const expectedContent = normalizeGeneratedContentForPersistence(source.generatedContent);
    if (
      record.sourceType !== "GENERATED" ||
      record.status !== "ACTIVE" ||
      record.visibility !== "PUBLIC" ||
      record.archivedAt != null ||
      id(record.categoryId) !== id(categories.get(source.categoryName)?._id) ||
      id(record.experienceLevelId) !== id(levels.get(source.experienceCode)?._id) ||
      record.generatedContent?.personalInfo?.email !== entry.candidateEmail ||
      record.generatedContent?.projects?.length !== expectedContent.projects.length ||
      record.generatedContent?.certifications?.length !== expectedContent.certifications.length
    ) {
      throw new Error("Existing Candidate CV differs from seed definition");
    }
    if (record.generatedContent?.professionalSummary !== expectedContent.professionalSummary) {
      // This one-time enrichment replaces only the original synthetic summary.
      if (
        record.generatedContent?.professionalSummary !== originalSeedSummary(entry, source)
      ) {
        throw new Error("Unexpected Generated CV summary drift");
      }
      summaryDrift += 1;
    }
  }
  return summaryDrift;
};

const run = async (apply) => {
  assertProductionTarget();
  const { entries, bands } = await loadSeed();
  let connected = false;
  try {
    const connection = await connectDatabase(MODEL_AUTO_INIT_DISABLED_OPTIONS);
    connected = true;
    if (connection.name !== DATABASE) throw new Error("Connected database guard failed");

    const emails = entries.map((entry) => entry.candidateEmail);
    const [users, categoryRows, levelRows, provinces] = await Promise.all([
      User.find({ email: { $in: emails } }).lean(),
      Category.find({ level: "FIELD", name: { $in: [...new Set(entries.map((entry) => entry.fieldName))] } }).lean(),
      ExperienceLevel.find({ code: { $in: Object.keys(EXPECTED_BANDS) } }).lean(),
      listProvinces(),
    ]);
    const userByEmail = new Map(users.map((user) => [user.email, user]));
    const categories = new Map(categoryRows.map((row) => [row.name, row]));
    const levels = new Map(levelRows.map((row) => [row.code, row]));
    const provinceCodes = new Set(provinces.map((province) => province.code));
    if (users.length !== 200 || categories.size !== 25 || levels.size !== 6) {
      throw new Error("Candidate or taxonomy preflight failed");
    }
    for (const entry of entries) {
      const user = userByEmail.get(entry.candidateEmail);
      if (
        !user || user.role !== "CANDIDATE" || user.status !== "ACTIVE" ||
        !user.emailVerifiedAt ||
        entry.cvs.some((cv) => !provinceCodes.has(cv.preferredLocations[0].provinceCode))
      ) {
        throw new Error("Candidate or Province preflight failed");
      }
    }
    const userIds = users.map((user) => user._id);
    const existingRows = await CandidateCV.find({ candidateUserId: { $in: userIds } }).lean();
    const existingByOwner = new Map();
    for (const row of existingRows) {
      const owner = id(row.candidateUserId);
      existingByOwner.set(owner, [...(existingByOwner.get(owner) ?? []), row]);
    }
    let summaryUpdatesNeeded = 0;
    for (const entry of entries) {
      summaryUpdatesNeeded += assertExisting(entry, existingByOwner.get(id(userByEmail.get(entry.candidateEmail)._id)) ?? [], categories, levels);
    }
    const report = {
      target: `${HOST}/${DATABASE}`,
      mode: apply ? "apply" : "dry-run",
      expectedCandidates: 200,
      expectedCvs: 400,
      existingCvs: existingRows.length,
      missingCvs: 400 - existingRows.length,
      summaryUpdatesNeeded,
      experienceBands: bands,
    };
    if (!apply) return report;

    await ensureCandidateCvCollectionInvariants(connection);
    await CandidateCV.createIndexes();
    let created = 0;
    let summariesUpdated = 0;
    let defaultsSet = 0;
    for (const entry of entries) {
      const user = userByEmail.get(entry.candidateEmail);
      const actorUser = new User(user);
      const ownerId = user._id;
      const current = existingByOwner.get(id(ownerId)) ?? [];
      for (const cv of entry.cvs) {
        const persisted = current.find((row) => row.name === cv.name);
        if (persisted) {
          const expectedSummary = normalizeGeneratedContentForPersistence(cv.generatedContent).professionalSummary;
          if (persisted.generatedContent.professionalSummary !== expectedSummary) {
            await saveOwnGeneratedContent({
              candidateUserId: ownerId,
              actorUser,
              candidateCvId: persisted._id,
              generatedContent: { professionalSummaryHtml: cv.generatedContent.professionalSummaryHtml },
            });
            persisted.generatedContent.professionalSummary = expectedSummary;
            summariesUpdated += 1;
          }
          continue;
        }
        const result = await createGeneratedDraftCandidateCv({
          candidateUserId: ownerId,
          actorUser,
          draft: {
            name: cv.name,
            visibility: cv.visibility,
            categoryId: categories.get(cv.categoryName)._id,
            experienceLevelId: levels.get(cv.experienceCode)._id,
            preferredLocations: cv.preferredLocations,
            skillTags: cv.skillTags,
            employmentTypes: cv.employmentTypes,
            workModes: cv.workModes,
          },
          generatedContent: cv.generatedContent,
          creationIntent: "COMPLETE",
        });
        current.push({ _id: new mongoose.Types.ObjectId(result.id), name: cv.name });
        created += 1;
      }
      const target = current.find((cv) => cv.name === entry.cvs[0].name);
      await setOwnCandidateCvAsDefault({ candidateUserId: ownerId, actorUser, candidateCvId: target._id });
      defaultsSet += 1;
      if (defaultsSet % 20 === 0) process.stdout.write(`Processed ${defaultsSet}/200 Candidates\n`);
    }

    const after = await CandidateCV.find({ candidateUserId: { $in: userIds } })
      .select("candidateUserId name sourceType status visibility isDefault categoryId experienceLevelId archivedAt generatedContent.professionalSummary generatedContent.projects generatedContent.certifications")
      .lean();
    if (after.length !== 400) throw new Error("Post-seed CV count mismatch");
    const afterByOwner = new Map();
    for (const cv of after) {
      const owner = id(cv.candidateUserId);
      afterByOwner.set(owner, [...(afterByOwner.get(owner) ?? []), cv]);
    }
    for (const entry of entries) {
      const ownerCvs = afterByOwner.get(id(userByEmail.get(entry.candidateEmail)._id)) ?? [];
      if (
        ownerCvs.length !== 2 ||
        ownerCvs.filter((cv) => cv.isDefault).length !== 1 ||
        ownerCvs.find((cv) => cv.isDefault)?.name !== entry.cvs[0].name ||
        ownerCvs.some((cv) => cv.generatedContent.professionalSummary !== normalizeGeneratedContentForPersistence(entry.cvs.find((source) => source.name === cv.name).generatedContent).professionalSummary) ||
        ownerCvs.some((cv) => cv.sourceType !== "GENERATED" || cv.status !== "ACTIVE" || cv.visibility !== "PUBLIC" || cv.archivedAt != null)
      ) {
        throw new Error("Post-seed Candidate CV invariant failed");
      }
    }
    return { ...report, created, summariesUpdated, verifiedCvs: after.length, verifiedDefaults: 200 };
  } finally {
    if (connected) await disconnectDatabase();
  }
};

const args = process.argv.slice(2);
if (args.length !== 1 || !["--dry-run", "--apply"].includes(args[0])) {
  process.stderr.write("Usage: node scripts/seed-production-cvs.js --dry-run|--apply\n");
  process.exitCode = 2;
} else {
  try {
    process.stdout.write(`${JSON.stringify(await run(args[0] === "--apply"), null, 2)}\n`);
  } catch {
    // Driver failures may contain credentials. Keep diagnostics out of stdout/stderr.
    process.stderr.write("Production CV seed failed. Check local data and retry dry-run.\n");
    process.exitCode = 1;
  }
}
