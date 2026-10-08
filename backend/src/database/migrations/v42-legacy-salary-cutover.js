import mongoose from "mongoose";

import { MODEL_AUTO_INIT_DISABLED_OPTIONS } from "../../config/mongodb.js";
import JOB_STATUS from "../../constants/job-status.js";
import SALARY_PERIOD from "../../constants/salary-period.js";
import SALARY_TYPE from "../../constants/salary-type.js";
import Job, {
  getJobSalaryInvariantErrors,
  isJobCollectionValidatorActive,
  JOB_COLLECTION_VALIDATION_OPTIONS,
} from "../../models/job.model.js";

const name = "v42-legacy-salary-cutover";

// Collections and indexes are never created as a side effect of connecting.
const connectionOptions = MODEL_AUTO_INIT_DISABLED_OPTIONS;

const UNRESOLVED_REASON = Object.freeze({
  UNRECOGNIZED_SALARY_TEXT: "UNRECOGNIZED_SALARY_TEXT",
  MISSING_SALARY: "MISSING_SALARY",
  INVALID_SALARY: "INVALID_SALARY",
});

// Targets that are not a Salary Type: an empty legacy value on a DRAFT stays
// NOT_DECLARED (BR-03), and an already valid Structured Salary is kept as is.
const NON_TYPE_TARGET = Object.freeze({
  NOT_DECLARED: "NOT_DECLARED",
  EXISTING_SALARY: "EXISTING_SALARY",
});

const CLASSIFICATION = Object.freeze({
  CANONICAL: "CANONICAL",
  LEGACY: "LEGACY",
  UNRESOLVED: "UNRESOLVED",
});

// Data V4.2 §8.4: only explicit, unambiguous legacy wording is mapped. A value
// without an explicit VND currency and an explicit canonical period is never
// mapped; `ETC` and any unlisted unit (e.g. year) are never inferred.
const LEGACY_NEGOTIABLE_TEXTS = Object.freeze(
  new Set(["negotiable", "thỏa thuận", "thoả thuận"]),
);

const LEGACY_PERIOD = Object.freeze({
  hour: SALARY_PERIOD.HOUR,
  giờ: SALARY_PERIOD.HOUR,
  day: SALARY_PERIOD.DAY,
  ngày: SALARY_PERIOD.DAY,
  week: SALARY_PERIOD.WEEK,
  tuần: SALARY_PERIOD.WEEK,
  month: SALARY_PERIOD.MONTH,
  tháng: SALARY_PERIOD.MONTH,
  shift: SALARY_PERIOD.SHIFT,
  ca: SALARY_PERIOD.SHIFT,
});

const MILLION = 1_000_000;

// Plain digits, or at least two thousands groups with one consistent separator
// ("1.500" and "1,500" are locale-ambiguous and therefore rejected).
const AMOUNT_PATTERN = String.raw`(\d{1,3}(?:,\d{3}){2,}|\d{1,3}(?:\.\d{3}){2,}|\d+)(?: (million|triệu))?`;
const SUFFIX_PATTERN = String.raw` ?(?:vnd|vnđ|₫|đ|đồng) ?(?:/|per) ?(${Object.keys(LEGACY_PERIOD).join("|")})`;

const LEGACY_SALARY_PATTERNS = Object.freeze([
  {
    type: SALARY_TYPE.RANGE,
    regex: new RegExp(
      String.raw`^${AMOUNT_PATTERN} ?[-–] ?${AMOUNT_PATTERN}${SUFFIX_PATTERN}$`,
      "u",
    ),
  },
  {
    type: SALARY_TYPE.FROM,
    regex: new RegExp(
      String.raw`^(?:from|từ) ${AMOUNT_PATTERN}${SUFFIX_PATTERN}$`,
      "u",
    ),
  },
  {
    type: SALARY_TYPE.UP_TO,
    regex: new RegExp(
      String.raw`^(?:up to|tối đa|lên đến|đến) ${AMOUNT_PATTERN}${SUFFIX_PATTERN}$`,
      "u",
    ),
  },
  {
    type: SALARY_TYPE.FIXED,
    regex: new RegExp(String.raw`^${AMOUNT_PATTERN}${SUFFIX_PATTERN}$`, "u"),
  },
]);

const MAX_DESCRIBED_RECORDS = 20;

const assertConnectionReady = (connection, step) => {
  if (connection.readyState !== 1) {
    throw new Error(
      `MongoDB connection must be ready before V4.2 legacy Salary ${step}`,
    );
  }
};

const normalizeLegacyText = (text) => {
  return text.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");
};

const toAmount = (digits, multiplier) => {
  const amount = Number(digits.replace(/[.,]/g, "")) * multiplier;

  return Number.isSafeInteger(amount) ? amount : null;
};

const buildSalary = (type, minAmount, maxAmount, period) => {
  return { type, minAmount, maxAmount, period, customPeriodLabel: null };
};

const parseLegacySalaryText = (text) => {
  const normalized = normalizeLegacyText(text);

  if (LEGACY_NEGOTIABLE_TEXTS.has(normalized)) {
    return buildSalary(SALARY_TYPE.NEGOTIABLE, null, null, null);
  }

  for (const { type, regex } of LEGACY_SALARY_PATTERNS) {
    const match = regex.exec(normalized);

    if (!match) {
      continue;
    }

    const period = LEGACY_PERIOD[match.at(-1)];

    if (type !== SALARY_TYPE.RANGE) {
      const amount = toAmount(match[1], match[2] ? MILLION : 1);

      if (amount == null) {
        return null;
      }

      return buildSalary(
        type,
        type === SALARY_TYPE.UP_TO ? null : amount,
        type === SALARY_TYPE.FROM ? null : amount,
        period,
      );
    }

    const [, lowerDigits, lowerUnit, upperDigits, upperUnit] = match;

    // "20 - 30 million" reads both bounds in millions; a unit on the lower
    // bound only ("20 million - 30") has no unambiguous upper bound.
    if (lowerUnit && !upperUnit) {
      return null;
    }

    const multiplier = upperUnit ? MILLION : 1;
    const minAmount = toAmount(lowerDigits, multiplier);
    const maxAmount = toAmount(upperDigits, multiplier);

    if (minAmount == null || maxAmount == null || minAmount > maxAmount) {
      return null;
    }

    return buildSalary(type, minAmount, maxAmount, period);
  }

  return null;
};

const isValidStructuredSalary = (salary) => {
  return salary != null && getJobSalaryInvariantErrors(salary).length === 0;
};

const unresolved = (reason) => ({ state: CLASSIFICATION.UNRESOLVED, reason });

const legacy = (target, salary) => ({
  state: CLASSIFICATION.LEGACY,
  target,
  salary,
});

const classifyJobSalary = (job) => {
  const isDraft = job.status === JOB_STATUS.DRAFT;
  const hasSalary = job.salary != null;

  if (hasSalary && !isValidStructuredSalary(job.salary)) {
    return unresolved(UNRESOLVED_REASON.INVALID_SALARY);
  }

  if (!Object.hasOwn(job, "salaryText")) {
    return hasSalary || (isDraft && Object.hasOwn(job, "salary"))
      ? { state: CLASSIFICATION.CANONICAL }
      : unresolved(UNRESOLVED_REASON.MISSING_SALARY);
  }

  if (hasSalary) {
    return legacy(NON_TYPE_TARGET.EXISTING_SALARY, undefined);
  }

  const { salaryText } = job;

  if (
    salaryText == null ||
    (typeof salaryText === "string" && salaryText.trim() === "")
  ) {
    return isDraft
      ? legacy(NON_TYPE_TARGET.NOT_DECLARED, null)
      : unresolved(UNRESOLVED_REASON.MISSING_SALARY);
  }

  const salary =
    typeof salaryText === "string" ? parseLegacySalaryText(salaryText) : null;

  return isValidStructuredSalary(salary)
    ? legacy(salary.type, salary)
    : unresolved(UNRESOLVED_REASON.UNRECOGNIZED_SALARY_TEXT);
};

const scanInventory = async () => {
  const scan = {
    totalJobs: 0,
    legacySalaryText: { total: 0, draft: 0, nonDraft: 0 },
    legacy: [],
    unresolved: [],
    nonDraftWithoutValidSalary: 0,
  };
  const cursor = Job.collection.find(
    {},
    { projection: { status: 1, salary: 1, salaryText: 1 } },
  );

  for await (const job of cursor) {
    const isDraft = job.status === JOB_STATUS.DRAFT;
    const classification = classifyJobSalary(job);

    scan.totalJobs += 1;

    if (Object.hasOwn(job, "salaryText")) {
      scan.legacySalaryText.total += 1;
      scan.legacySalaryText[isDraft ? "draft" : "nonDraft"] += 1;
    }

    if (!isDraft && !isValidStructuredSalary(job.salary)) {
      scan.nonDraftWithoutValidSalary += 1;
    }

    if (classification.state === CLASSIFICATION.LEGACY) {
      scan.legacy.push({
        _id: job._id,
        status: job.status,
        salaryText: job.salaryText,
        target: classification.target,
        salary: classification.salary,
      });
    } else if (classification.state === CLASSIFICATION.UNRESOLVED) {
      scan.unresolved.push({
        id: job._id.toString(),
        status: job.status,
        reason: classification.reason,
        ...(Object.hasOwn(job, "salaryText")
          ? { salaryText: job.salaryText }
          : {}),
      });
    }
  }

  return scan;
};

const countBy = (records, key) => {
  return records.reduce((counts, record) => {
    counts[record[key]] = (counts[record[key]] ?? 0) + 1;

    return counts;
  }, {});
};

// The only owner that applies the strict Job validator; callers must have
// verified zero legacy and zero invalid Salary first.
const applyStrictSalaryGuard = async (connection) => {
  await Job.init();

  const collectionName = Job.collection.collectionName;
  const applyValidator = () =>
    connection.db.command({
      collMod: collectionName,
      ...JOB_COLLECTION_VALIDATION_OPTIONS,
    });

  try {
    await applyValidator();
    return;
  } catch (error) {
    const isMissingNamespace =
      error?.code === 26 ||
      error?.codeName === "NamespaceNotFound" ||
      /ns does not exist/i.test(error?.message ?? "");

    if (!isMissingNamespace) {
      throw error;
    }
  }

  try {
    await connection.db.createCollection(
      collectionName,
      JOB_COLLECTION_VALIDATION_OPTIONS,
    );
  } catch (error) {
    const collectionAlreadyExists =
      error?.codeName === "NamespaceExists" ||
      /already exists/i.test(error?.message ?? "");

    if (!collectionAlreadyExists) {
      throw error;
    }

    await applyValidator();
  }
};

const toInventoryReport = async (scan, connection) => {
  return {
    name,
    totalJobs: scan.totalJobs,
    legacySalaryText: scan.legacySalaryText,
    deterministic: {
      total: scan.legacy.length,
      byTarget: countBy(scan.legacy, "target"),
    },
    unresolved: {
      total: scan.unresolved.length,
      byReason: countBy(scan.unresolved, "reason"),
      records: scan.unresolved.slice(0, MAX_DESCRIBED_RECORDS),
    },
    nonDraftWithoutValidSalary: scan.nonDraftWithoutValidSalary,
    strictSalaryGuardActive: await isJobCollectionValidatorActive(connection),
  };
};

const describeUnresolvedRecords = (records) => {
  const described = records
    .slice(0, MAX_DESCRIBED_RECORDS)
    .map((record) => `jobs/${record.id} (${record.status}): ${record.reason}`)
    .join(", ");

  return records.length > MAX_DESCRIBED_RECORDS
    ? `${described}, … (${records.length - MAX_DESCRIBED_RECORDS} more)`
    : described;
};

const createBlockedError = (message, report) => {
  const error = new Error(message);

  error.inventory = report;

  return error;
};

const convertLegacyJobs = async (legacyEntries) => {
  const result = { converted: 0, changedConcurrently: [], failed: [] };

  for (const { _id, status, salaryText, target, salary } of legacyEntries) {
    const keepsExistingSalary = target === NON_TYPE_TARGET.EXISTING_SALARY;

    // Conditional on the scanned state so one Job either receives its full
    // Structured Salary and loses `salaryText` in the same document write, or
    // stays exactly as it was. The raw driver write leaves `updatedAt` as is.
    const filter = {
      _id,
      status,
      salaryText: { $exists: true, $eq: salaryText },
      salary: keepsExistingSalary ? { $type: "object" } : null,
    };
    const update = keepsExistingSalary
      ? { $unset: { salaryText: "" } }
      : { $set: { salary }, $unset: { salaryText: "" } };

    try {
      const { modifiedCount } = await Job.collection.updateOne(filter, update);

      if (modifiedCount === 1) {
        result.converted += 1;
      } else {
        result.changedConcurrently.push(_id.toString());
      }
    } catch (error) {
      result.failed.push({ id: _id.toString(), message: error.message });
    }
  }

  return result;
};

const findCutoverProblems = (report) => {
  const problems = [];

  if (report.legacySalaryText.total > 0) {
    problems.push(
      `${report.legacySalaryText.total} Job(s) still persist legacy salaryText`,
    );
  }

  if (report.nonDraftWithoutValidSalary > 0) {
    problems.push(
      `${report.nonDraftWithoutValidSalary} non-DRAFT Job(s) lack a valid Structured Salary`,
    );
  }

  if (report.unresolved.total > 0) {
    problems.push(
      `${report.unresolved.total} Job(s) require remediation: ${describeUnresolvedRecords(report.unresolved.records)}`,
    );
  }

  return problems;
};

const assertCutoverComplete = async (connection) => {
  const report = await toInventoryReport(await scanInventory(), connection);
  const problems = findCutoverProblems(report);

  if (!report.strictSalaryGuardActive) {
    problems.push(
      "the strict non-DRAFT Salary collection validator is not active",
    );
  }

  if (problems.length > 0) {
    throw createBlockedError(
      `V4.2 legacy Salary cutover verification failed: ${problems.join("; ")}`,
      report,
    );
  }

  return report;
};

const preflight = async (connection = mongoose.connection) => {
  assertConnectionReady(connection, "preflight");

  return toInventoryReport(await scanInventory(), connection);
};

const migrate = async (connection = mongoose.connection) => {
  assertConnectionReady(connection, "migration");

  const scan = await scanInventory();
  const preflightReport = await toInventoryReport(scan, connection);

  if (scan.unresolved.length > 0) {
    throw createBlockedError(
      `V4.2 legacy Salary migration blocked before any write: ${scan.unresolved.length} Job(s) require remediation: ${describeUnresolvedRecords(scan.unresolved)}`,
      preflightReport,
    );
  }

  const writeResult = await convertLegacyJobs(scan.legacy);
  const postWriteReport = await toInventoryReport(
    await scanInventory(),
    connection,
  );
  const remaining = findCutoverProblems(postWriteReport);

  if (remaining.length > 0) {
    const failures = [
      ...writeResult.failed.map(
        (failure) => `jobs/${failure.id}: ${failure.message}`,
      ),
      ...writeResult.changedConcurrently.map(
        (id) => `jobs/${id}: changed concurrently`,
      ),
    ];

    throw createBlockedError(
      `V4.2 legacy Salary migration incomplete; strict Salary guard not applied: ${remaining.join("; ")}${
        failures.length > 0
          ? ` (${failures.slice(0, MAX_DESCRIBED_RECORDS).join(", ")})`
          : ""
      }`,
      postWriteReport,
    );
  }

  await applyStrictSalaryGuard(connection);

  const verification = await assertCutoverComplete(connection);

  return {
    name,
    preflight: preflightReport,
    converted: writeResult.converted,
    verification,
  };
};

const verify = async (connection = mongoose.connection) => {
  assertConnectionReady(connection, "verification");

  const report = await assertCutoverComplete(connection);

  return { ok: true, ...report };
};

export {
  connectionOptions,
  migrate,
  name,
  NON_TYPE_TARGET,
  parseLegacySalaryText,
  preflight,
  UNRESOLVED_REASON,
  verify,
};
