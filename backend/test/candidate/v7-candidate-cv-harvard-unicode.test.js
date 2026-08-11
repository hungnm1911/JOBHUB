import { inflateSync } from "node:zlib";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_STATUS from "../../src/constants/candidate-cv-status.js";
import CANDIDATE_CV_VISIBILITY from "../../src/constants/candidate-cv-visibility.js";
import CATEGORY_LEVEL from "../../src/constants/category-level.js";
import CV_LANGUAGE_PROFICIENCY from "../../src/constants/cv-language-proficiency.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import Category from "../../src/models/category.model.js";
import { renderHarvardCandidateCvPdf } from "../../src/services/candidate-cv-harvard-pdf.service.js";
import * as fileService from "../../src/services/file.service.js";
import {
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const vietnameseGeneratedContent = () => {
  return {
    personalInfo: {
      fullName: "Nguyễn Văn Hùng",
      email: "hung@example.com",
      phone: "+84901234567",
      displayLocation: "Hà Nội",
      links: [],
      avatarUrl: null,
    },
    professionalSummary: "Kỹ sư phần mềm",
    educations: [
      {
        institutionName: "Đại học Bách Khoa Hà Nội",
        degree: "Kỹ sư",
        fieldOfStudy: "Công nghệ thông tin",
        startDate: "2018",
        endDate: "2022",
      },
    ],
    skills: ["Node.js", "Phần mềm"],
    workExperiences: [],
    projects: [],
    certifications: [],
    languages: [
      {
        name: "Tiếng Việt",
        proficiency: CV_LANGUAGE_PROFICIENCY.NATIVE,
      },
    ],
    hiddenSections: [],
  };
};

const inflatePdfStreams = (pdfBuffer) => {
  const raw = pdfBuffer.toString("binary");
  const inflated = [];
  let position = 0;

  while (true) {
    const streamMarker = raw.indexOf("stream", position);

    if (streamMarker === -1) {
      break;
    }

    let dataStart = streamMarker + "stream".length;

    if (raw[dataStart] === "\r") {
      dataStart += 1;
    }

    if (raw[dataStart] === "\n") {
      dataStart += 1;
    }

    const endMarker = raw.indexOf("endstream", dataStart);

    if (endMarker === -1) {
      break;
    }

    let dataEnd = endMarker;

    if (raw[dataEnd - 1] === "\n") {
      dataEnd -= 1;
    }

    if (raw[dataEnd - 1] === "\r") {
      dataEnd -= 1;
    }

    try {
      inflated.push(
        inflateSync(Buffer.from(raw.slice(dataStart, dataEnd), "binary")).toString(
          "binary",
        ),
      );
    } catch {
      // Ignore non-FlateDecode streams.
    }

    position = endMarker + "endstream".length;
  }

  return inflated.join("\n");
};

const decodePdfHexStrings = (content) => {
  return [...content.matchAll(/<([0-9A-Fa-f]+)>/g)].map((match) =>
    Buffer.from(match[1], "hex").toString("binary"),
  );
};

const createFieldCategory = async (name = "Unicode Field") => {
  return Category.create({
    name,
    level: CATEGORY_LEVEL.FIELD,
    parentCategoryId: null,
  });
};

const createGeneratedCv = async ({
  candidateUserId,
  categoryId,
  status,
  generatedContent = vietnameseGeneratedContent(),
}) => {
  return CandidateCV.create({
    candidateUserId,
    name: "Unicode Generated CV",
    sourceType: CANDIDATE_CV_SOURCE_TYPE.GENERATED,
    status,
    visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
    categoryId,
    experienceLevelId: null,
    preferredLocations: [],
    skillTags: [],
    employmentTypes: [],
    workModes: [],
    isDefault: false,
    archivedAt: null,
    generatedContent,
  });
};

describe("V7 acceptance — Harvard Unicode rendering (F08)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("renders Vietnamese Generated content without ASCII/? sanitization", async () => {
    const pdfBuffer = await renderHarvardCandidateCvPdf(
      vietnameseGeneratedContent(),
    );
    const inflated = inflatePdfStreams(pdfBuffer);
    const drawnText = decodePdfHexStrings(inflated).join("\n");

    expect(pdfBuffer.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(drawnText).not.toContain("Nguye??n");
    expect(drawnText).not.toContain("Va?n");
    expect(drawnText).not.toContain("Hu?ng");
    expect(drawnText).not.toContain("Ky? su?");
    expect(drawnText).not.toMatch(/K\?.*s\?/);
    expect(inflated).not.toMatch(/\/Encoding \/WinAnsiEncoding/);
    expect(inflated).toMatch(/NotoSerif/);
    expect(inflated).toMatch(/Identity-H|ToUnicode/);
    // Precomposed Vietnamese code points must remain available to the embedded font cmap.
    expect(inflated.toUpperCase()).toMatch(/1EC5|1EA1|1ED9|0111|1B0/);
  });

  it("previews Generated DRAFT Vietnamese content successfully", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.unicode.draft@example.com",
    });
    const category = await createFieldCategory("Unicode Draft");
    const draftCv = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      status: CANDIDATE_CV_STATUS.DRAFT,
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const response = await agent
      .get(`/api/candidate/cvs/${draftCv._id}/preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/pdf/);
    expect(response.body.subarray(0, 4).toString("utf8")).toBe("%PDF");

    const drawnText = decodePdfHexStrings(
      inflatePdfStreams(response.body),
    ).join("\n");
    expect(drawnText).not.toContain("Nguye??n");
    expect(drawnText).not.toContain("Va?n");

    const after = await CandidateCV.findById(draftCv._id).lean();
    expect(after.status).toBe(CANDIDATE_CV_STATUS.DRAFT);
    expect(after.generatedContent.personalInfo.fullName).toBe("Nguyễn Văn Hùng");
  });

  it("officially downloads Generated ACTIVE Vietnamese content successfully", async () => {
    const { user } = await createVerifiedUser({
      email: "cv.unicode.active@example.com",
    });
    const category = await createFieldCategory("Unicode Active");
    const activeCv = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      status: CANDIDATE_CV_STATUS.ACTIVE,
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const deniedDraftDownload = await agent
      .get(`/api/candidate/cvs/${activeCv._id}/download`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    // Sanity: ACTIVE download is allowed (full assertion below).
    expect(deniedDraftDownload.status).toBe(200);

    const draftOnly = await createGeneratedCv({
      candidateUserId: user._id,
      categoryId: category._id,
      status: CANDIDATE_CV_STATUS.DRAFT,
    });
    const draftDownload = await agent
      .get(`/api/candidate/cvs/${draftOnly._id}/download`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(draftDownload.status).toBe(409);

    const response = deniedDraftDownload;
    expect(response.headers["content-disposition"]).toContain("attachment");
    const drawnText = decodePdfHexStrings(
      inflatePdfStreams(response.body),
    ).join("\n");
    expect(drawnText).not.toContain("Nguye??n");
    expect(drawnText).not.toContain("Đ?i h?c");
  });

  it("does not change Uploaded Preview/Download storage fetch behavior", async () => {
    const uploadPdf = Buffer.from("%PDF-1.4 uploaded-unicode-guard");
    const downloadSpy = vi
      .spyOn(fileService, "downloadFileBuffer")
      .mockResolvedValue(uploadPdf);

    const { user } = await createVerifiedUser({
      email: "cv.unicode.uploaded@example.com",
    });
    const category = await createFieldCategory("Unicode Uploaded");
    const uploadedCv = await CandidateCV.create({
      candidateUserId: user._id,
      name: "Uploaded Guard",
      sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
      status: CANDIDATE_CV_STATUS.ACTIVE,
      visibility: CANDIDATE_CV_VISIBILITY.PRIVATE,
      categoryId: category._id,
      preferredLocations: [],
      skillTags: [],
      employmentTypes: [],
      workModes: [],
      isDefault: false,
      archivedAt: null,
      uploadedFile: {
        storageKey: "jobhub/candidate-cvs/uploaded/unicode-guard",
        originalFileName: "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: uploadPdf.length,
        pageCount: 1,
        uploadedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: user.email,
    });

    const preview = await agent
      .get(`/api/candidate/cvs/${uploadedCv._id}/preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });

    expect(preview.status).toBe(200);
    expect(preview.body.equals(uploadPdf)).toBe(true);
    expect(downloadSpy).toHaveBeenCalled();
  });
});
