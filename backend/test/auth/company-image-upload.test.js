import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import CLOUDINARY_FOLDER from "../../src/constants/cloudinary-folder.js";
import COMPANY_IMAGE_KIND from "../../src/constants/company-image-kind.js";
import * as fileService from "../../src/services/file.service.js";
import { DEFAULT_PASSWORD } from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

vi.mock("../../src/services/mail.service.js", () => ({
  default: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
}));

// 1x1 PNG so file-type detection accepts the upload as image/png.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const registerCompanyManager = async (agent, { email }) => {
  const response = await agent.post("/api/auth/register/company-manager").send({
    fullName: "Image Manager",
    email,
    password: DEFAULT_PASSWORD,
  });

  expect(response.status).toBe(201);

  return response.body;
};

describe("POST /api/company/images/:kind", () => {
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

  it("uploads a company logo for an onboarding Company Manager and returns a public URL", async () => {
    const agent = createTestAgent();

    const registration = await registerCompanyManager(agent, {
      email: "manager.logo-upload@example.com",
    });

    const uploadSpy = vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      assetId: "asset-1",
      publicId: "jobhub/companies/logos/logo-1",
      resourceType: "image",
      deliveryType: "upload",
      format: "png",
      bytes: TINY_PNG.length,
      width: 1,
      height: 1,
      secureUrl: "https://res.cloudinary.com/demo/image/upload/logo-1.png",
      version: 1,
      assetFolder: CLOUDINARY_FOLDER.COMPANY_LOGOS,
    });

    const response = await agent
      .post(`/api/company/images/${COMPANY_IMAGE_KIND.LOGO}`)
      .set("Authorization", `Bearer ${registration.accessToken}`)
      .attach("file", TINY_PNG, "logo.png");

    expect(response.status).toBe(201);
    expect(response.body.image).toMatchObject({
      kind: COMPANY_IMAGE_KIND.LOGO,
      url: "https://res.cloudinary.com/demo/image/upload/logo-1.png",
      publicId: "jobhub/companies/logos/logo-1",
    });
    expect(uploadSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assetFolder: CLOUDINARY_FOLDER.COMPANY_LOGOS,
        resourceType: "image",
      }),
    );
  });

  it("uploads a company banner into the banners folder", async () => {
    const agent = createTestAgent();

    const registration = await registerCompanyManager(agent, {
      email: "manager.banner-upload@example.com",
    });

    vi.spyOn(fileService, "uploadFileBuffer").mockResolvedValue({
      assetId: "asset-2",
      publicId: "jobhub/companies/banners/banner-1",
      resourceType: "image",
      deliveryType: "upload",
      format: "png",
      bytes: TINY_PNG.length,
      width: 1,
      height: 1,
      secureUrl: "https://res.cloudinary.com/demo/image/upload/banner-1.png",
      version: 1,
      assetFolder: CLOUDINARY_FOLDER.COMPANY_BANNERS,
    });

    const response = await agent
      .post(`/api/company/images/${COMPANY_IMAGE_KIND.BANNER}`)
      .set("Authorization", `Bearer ${registration.accessToken}`)
      .attach("file", TINY_PNG, "banner.png");

    expect(response.status).toBe(201);
    expect(response.body.image.kind).toBe(COMPANY_IMAGE_KIND.BANNER);
    expect(fileService.uploadFileBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        assetFolder: CLOUDINARY_FOLDER.COMPANY_BANNERS,
      }),
    );
  });

  it("rejects an unknown image kind", async () => {
    const agent = createTestAgent();

    const registration = await registerCompanyManager(agent, {
      email: "manager.bad-kind@example.com",
    });

    const uploadSpy = vi.spyOn(fileService, "uploadFileBuffer");

    const response = await agent
      .post("/api/company/images/avatar")
      .set("Authorization", `Bearer ${registration.accessToken}`)
      .attach("file", TINY_PNG, "logo.png");

    expect(response.status).toBe(400);
    expect(response.body.error.details?.field).toBe("kind");
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated uploads", async () => {
    const agent = createTestAgent();

    const response = await agent
      .post(`/api/company/images/${COMPANY_IMAGE_KIND.LOGO}`)
      .attach("file", TINY_PNG, "logo.png");

    expect(response.status).toBe(401);
  });
});
