import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import USER_ROLE from "../../src/constants/user-role.js";
import USER_STATUS from "../../src/constants/user-status.js";
import AuthSession from "../../src/models/auth-session.model.js";
import AuthToken from "../../src/models/auth-token.model.js";
import CandidateCV from "../../src/models/candidate-cv.model.js";
import User from "../../src/models/user.model.js";
import {
  PROFILE_READABLE_FIELDS,
  PROFILE_WRITABLE_FIELDS,
} from "../../src/services/candidate-profile.service.js";
import {
  createActiveCompanyManagerContext,
  createVerifiedUser,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const serviceSourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/services/candidate-profile.service.js",
);

const PROFILE_RESPONSE_KEYS = [...PROFILE_READABLE_FIELDS].sort();

describe("V7 Slice 01 — Candidate Profile (F01; BR-01–BR-03)", () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("lets an authenticated Candidate read only the F01 Profile field matrix from User", async () => {
    const dateOfBirth = new Date("1994-03-12T00:00:00.000Z");

    const { user } = await createVerifiedUser({
      email: "candidate.profile@example.com",
      fullName: "Jane Candidate",
    });

    await User.findByIdAndUpdate(user._id, {
      $set: {
        avatarUrl: "https://cdn.example/avatar.png",
        dateOfBirth,
        phoneNumber: "+84901234567",
      },
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: "candidate.profile@example.com",
    });

    const response = await agent
      .get("/api/candidate/profile")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.profile).sort()).toEqual(
      PROFILE_RESPONSE_KEYS,
    );
    expect(response.body.profile).toEqual({
      fullName: "Jane Candidate",
      avatarUrl: "https://cdn.example/avatar.png",
      dateOfBirth: dateOfBirth.toISOString(),
      phoneNumber: "+84901234567",
      email: "candidate.profile@example.com",
    });
    expect(response.body.profile).not.toHaveProperty("role");
    expect(response.body.profile).not.toHaveProperty("status");
    expect(response.body.profile).not.toHaveProperty("passwordHash");
    expect(response.body.profile).not.toHaveProperty("emailVerifiedAt");
    expect(response.body.profile).not.toHaveProperty("mustChangePassword");
  });

  it("updates only F01 writable Profile fields on the existing User document", async () => {
    const { user } = await createVerifiedUser({
      email: "candidate.update@example.com",
      fullName: "Original Name",
    });

    const before = await User.findById(user._id).select("+passwordHash");
    const userCountBefore = await User.countDocuments();

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: "candidate.update@example.com",
    });

    const sessionCountBefore = await AuthSession.countDocuments({
      userId: user._id,
    });
    const tokenCountBefore = await AuthToken.countDocuments({
      userId: user._id,
    });

    const response = await agent
      .patch("/api/candidate/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Updated Name",
        avatarUrl: "https://cdn.example/new-avatar.png",
        dateOfBirth: "1990-01-15",
        phoneNumber: "+84987654321",
      });

    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/profile updated/i);
    expect(response.body.profile).toMatchObject({
      fullName: "Updated Name",
      avatarUrl: "https://cdn.example/new-avatar.png",
      phoneNumber: "+84987654321",
      email: "candidate.update@example.com",
    });
    expect(new Date(response.body.profile.dateOfBirth).toISOString()).toBe(
      new Date("1990-01-15").toISOString(),
    );

    const after = await User.findById(user._id).select("+passwordHash");

    expect(await User.countDocuments()).toBe(userCountBefore);
    expect(after._id.toString()).toBe(before._id.toString());
    expect(after.fullName).toBe("Updated Name");
    expect(after.avatarUrl).toBe("https://cdn.example/new-avatar.png");
    expect(after.phoneNumber).toBe("+84987654321");
    expect(after.email).toBe(before.email);
    expect(after.role).toBe(USER_ROLE.CANDIDATE);
    expect(after.status).toBe(USER_STATUS.ACTIVE);
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.emailVerifiedAt?.toISOString()).toBe(
      before.emailVerifiedAt?.toISOString(),
    );
    expect(after.mustChangePassword).toBe(before.mustChangePassword);

    expect(
      await AuthSession.countDocuments({
        userId: user._id,
      }),
    ).toBe(sessionCountBefore);
    expect(
      await AuthToken.countDocuments({
        userId: user._id,
      }),
    ).toBe(tokenCountBefore);

    expect(
      mongoose.connection.collections.candidateprofiles,
    ).toBeUndefined();
    expect(mongoose.models.CandidateProfile).toBeUndefined();
  });

  it("rejects email and account/authentication fields through F01 update", async () => {
    await createVerifiedUser({
      email: "candidate.readonly@example.com",
      fullName: "Readonly Candidate",
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: "candidate.readonly@example.com",
    });

    const emailAttempt = await agent
      .patch("/api/candidate/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "hijacked@example.com",
      });

    expect(emailAttempt.status).toBe(400);

    const authFieldAttempt = await agent
      .patch("/api/candidate/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Still Valid Name",
        role: USER_ROLE.PLATFORM_ADMIN,
        status: USER_STATUS.TERMINATED,
        passwordHash: "not-a-hash",
        emailVerifiedAt: null,
        mustChangePassword: true,
      });

    expect(authFieldAttempt.status).toBe(400);

    const persisted = await User.findOne({
      email: "candidate.readonly@example.com",
    }).select("+passwordHash");

    expect(persisted.fullName).toBe("Readonly Candidate");
    expect(persisted.email).toBe("candidate.readonly@example.com");
    expect(persisted.role).toBe(USER_ROLE.CANDIDATE);
    expect(persisted.status).toBe(USER_STATUS.ACTIVE);
    expect(persisted.mustChangePassword).toBe(false);
    expect(persisted.emailVerifiedAt).not.toBeNull();
    expect(persisted.passwordHash).not.toBe("not-a-hash");
  });

  it("keeps Profile ownership on the authenticated Candidate only (BR-01)", async () => {
    const { user: owner } = await createVerifiedUser({
      email: "owner.candidate@example.com",
      fullName: "Owner Candidate",
    });
    const { user: other } = await createVerifiedUser({
      email: "other.candidate@example.com",
      fullName: "Other Candidate",
    });

    await User.findByIdAndUpdate(other._id, {
      $set: {
        phoneNumber: "+84000000000",
      },
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: "owner.candidate@example.com",
    });

    const foreignIdAttempt = await agent
      .patch("/api/candidate/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        userId: other._id.toString(),
        id: other._id.toString(),
        fullName: "Should Not Apply To Other",
      });

    expect(foreignIdAttempt.status).toBe(400);

    const updateOwn = await agent
      .patch("/api/candidate/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Owner Updated",
        phoneNumber: "+84111111111",
      });

    expect(updateOwn.status).toBe(200);
    expect(updateOwn.body.profile.fullName).toBe("Owner Updated");
    expect(updateOwn.body.profile.email).toBe("owner.candidate@example.com");

    const ownerAfter = await User.findById(owner._id);
    const otherAfter = await User.findById(other._id);

    expect(ownerAfter.fullName).toBe("Owner Updated");
    expect(ownerAfter.phoneNumber).toBe("+84111111111");
    expect(otherAfter.fullName).toBe("Other Candidate");
    expect(otherAfter.phoneNumber).toBe("+84000000000");
  });

  it("denies non-Candidate actors from Profile read and update", async () => {
    const manager = await createActiveCompanyManagerContext({
      email: "manager.profile@example.com",
    });
    await createVerifiedUser({
      email: "admin.profile@example.com",
      role: USER_ROLE.PLATFORM_ADMIN,
      fullName: "Platform Admin",
    });

    const agent = createTestAgent();
    const managerToken = await loginAndGetAccessToken(agent, {
      email: manager.user.email,
    });
    const adminToken = await loginAndGetAccessToken(agent, {
      email: "admin.profile@example.com",
    });

    for (const token of [managerToken, adminToken]) {
      const getResponse = await agent
        .get("/api/candidate/profile")
        .set("Authorization", `Bearer ${token}`);
      const patchResponse = await agent
        .patch("/api/candidate/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({
          fullName: "Unauthorized",
        });

      expect(getResponse.status).toBe(403);
      expect(patchResponse.status).toBe(403);
    }
  });

  it("preserves Profile/CV independence boundary for F01 (BR-03)", async () => {
    const serviceSource = fs.readFileSync(serviceSourcePath, "utf8");

    expect(serviceSource).not.toMatch(/CandidateCV|candidate-cv|candidatecvs/i);
    expect(PROFILE_WRITABLE_FIELDS).toEqual([
      "fullName",
      "avatarUrl",
      "dateOfBirth",
      "phoneNumber",
    ]);
    expect(PROFILE_READABLE_FIELDS).toEqual([
      "fullName",
      "avatarUrl",
      "dateOfBirth",
      "phoneNumber",
      "email",
    ]);

    await createVerifiedUser({
      email: "independence@example.com",
      fullName: "Independence Candidate",
    });

    const agent = createTestAgent();
    const accessToken = await loginAndGetAccessToken(agent, {
      email: "independence@example.com",
    });

    const candidateCvCountBefore = await CandidateCV.countDocuments();
    const collectionsBefore = new Set(
      Object.keys(mongoose.connection.collections),
    );

    const response = await agent
      .patch("/api/candidate/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        fullName: "Independence Updated",
        avatarUrl: null,
        phoneNumber: null,
        dateOfBirth: null,
      });

    expect(response.status).toBe(200);
    expect(response.body.profile).toMatchObject({
      fullName: "Independence Updated",
      avatarUrl: null,
      phoneNumber: null,
      dateOfBirth: null,
      email: "independence@example.com",
    });

    expect(await CandidateCV.countDocuments()).toBe(candidateCvCountBefore);

    const collectionsAfter = Object.keys(mongoose.connection.collections);
    const newCollections = collectionsAfter.filter(
      (name) => !collectionsBefore.has(name),
    );

    expect(newCollections).toEqual([]);
    expect(
      collectionsAfter.some((name) => /candidate.?profile/i.test(name)),
    ).toBe(false);
  });

  it("requires authentication for Candidate Profile endpoints", async () => {
    const agent = createTestAgent();

    const getResponse = await agent.get("/api/candidate/profile");
    const patchResponse = await agent.patch("/api/candidate/profile").send({
      fullName: "No Auth",
    });

    expect(getResponse.status).toBe(401);
    expect(patchResponse.status).toBe(401);
  });
});
