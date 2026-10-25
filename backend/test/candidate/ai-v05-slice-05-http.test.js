import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const recommend = vi.hoisted(() => vi.fn());
vi.mock("../../src/services/candidate-job-recommendation.service.js", () => ({
  recommendOwnDefaultCvJobs: recommend,
}));

import USER_ROLE from "../../src/constants/user-role.js";
import { createVerifiedUser, loginAndGetAccessToken } from "../helpers/auth-fixtures.js";
import { clearDatabase, connectTestDatabase, createTestAgent,
  disconnectTestDatabase } from "../helpers/database.js";

beforeAll(connectTestDatabase);
afterAll(disconnectTestDatabase);
beforeEach(async () => { await clearDatabase(); vi.clearAllMocks(); });

describe("AI-V05 F04 Candidate HTTP delivery", () => {
  it("authenticates and authorizes before returning the ordered public recommendations", async () => {
    const agent = createTestAgent();
    const candidate = await createVerifiedUser({ email: "recommend-candidate@example.com" });
    const candidateToken = await loginAndGetAccessToken(agent, { email: candidate.user.email });
    const admin = await createVerifiedUser({ email: "recommend-admin@example.com",
      role: USER_ROLE.PLATFORM_ADMIN });
    const adminToken = await loginAndGetAccessToken(agent, { email: admin.user.email });
    const recommendations = [{ job: { id: "public-job", title: "Engineer" },
      matchScore: 0, reason: "Limited evidence." }];
    recommend.mockResolvedValue(recommendations);

    await agent.post("/api/candidate/job-recommendations").expect(401);
    await agent.post("/api/candidate/job-recommendations")
      .set("Authorization", `Bearer ${adminToken}`).expect(403);
    expect(recommend).not.toHaveBeenCalled();

    const response = await agent.post("/api/candidate/job-recommendations")
      .set("Authorization", `Bearer ${candidateToken}`).expect(200);
    expect(response.body).toEqual({ recommendations });
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(recommend).toHaveBeenCalledWith({ actorUser: expect.objectContaining({
      _id: candidate.user._id,
    }) });
  });

  it("forwards failure through the existing HTTP error convention", async () => {
    const agent = createTestAgent();
    const candidate = await createVerifiedUser({ email: "recommend-error@example.com" });
    const token = await loginAndGetAccessToken(agent, { email: candidate.user.email });
    recommend.mockRejectedValue(new Error("Provider failed"));

    const response = await agent.post("/api/candidate/job-recommendations")
      .set("Authorization", `Bearer ${token}`).expect(500);
    expect(response.body).toMatchObject({ error: { message: "Internal server error" } });
  });
});
