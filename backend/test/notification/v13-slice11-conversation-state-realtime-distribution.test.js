import http from "node:http";
import mongoose from "mongoose";
import { io as connectSocketClient } from "socket.io-client";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import config from "../../src/config/index.js";
import APPLICATION_SOURCE from "../../src/constants/application-source.js";
import APPLICATION_STATUS from "../../src/constants/application-status.js";
import CANDIDATE_CV_SOURCE_TYPE from "../../src/constants/candidate-cv-source-type.js";
import CANDIDATE_CV_UPLOADED_PDF from "../../src/constants/candidate-cv-uploaded-pdf.js";
import CONVERSATION_REALTIME_MODE from "../../src/constants/conversation-realtime-mode.js";
import JOB_STATUS from "../../src/constants/job-status.js";
import REALTIME_EVENT from "../../src/constants/realtime-event.js";
import AuthSession from "../../src/models/auth-session.model.js";
import Application from "../../src/models/application.model.js";
import Conversation from "../../src/models/conversation.model.js";
import Job from "../../src/models/job.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import {
  automaticallyUnassignApplication,
  firstAssignApplication,
  reassignApplication,
  unassignApplication,
  updateApplicationRecruitmentPipelineStatus,
} from "../../src/services/application.service.js";
import {
  attachRealtimeDistribution,
  closeRealtimeDistribution,
} from "../../src/services/realtime-distribution.service.js";
import { generateAuthToken, hashAuthToken } from "../../src/utils/hash-auth-token.js";
import { generateAccessToken } from "../../src/utils/jwt.js";
import {
  createActiveCompanyManagerContext,
  createActiveRecruiterContext,
  createVerifiedUser,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-14T10:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-14T10:00:00.000Z");

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const listenHttpServer = (server) => {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error) => {
      if (error) {
        reject(error);

        return;
      }

      resolve(server.address().port);
    });
  });
};

const closeListeningHttpServer = (server) => {
  return new Promise((resolve, reject) => {
    if (!server?.listening) {
      resolve();

      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);

        return;
      }

      resolve();
    });
  });
};

const issueAccessToken = async (user) => {
  const session = await AuthSession.create({
    userId: user._id,
    refreshTokenHash: hashAuthToken(generateAuthToken()),
    expiresAt: new Date(Date.now() + config.authSession.expiresInMs),
  });

  return generateAccessToken({
    userId: user._id.toString(),
    role: user.role,
    sessionId: session._id.toString(),
  });
};

const openSocket = ({ port, accessToken } = {}) => {
  return connectSocketClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    auth: accessToken ? { accessToken } : {},
  });
};

const waitForConnect = (socket, timeoutMs = 2_000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for socket connect"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };

    const onConnect = () => {
      cleanup();
      resolve(socket);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    if (socket.connected) {
      cleanup();
      resolve(socket);

      return;
    }

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
  });
};

const waitForConversationState = (socket, timeoutMs = 2_000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(REALTIME_EVENT.CONVERSATION_STATE, onEvent);
      reject(new Error("Timed out waiting for conversation state realtime event"));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(REALTIME_EVENT.CONVERSATION_STATE, onEvent);
  });
};

const collectConversationStates = async (socket, durationMs = 250) => {
  const received = [];
  const onEvent = (payload) => {
    received.push(payload);
  };

  socket.on(REALTIME_EVENT.CONVERSATION_STATE, onEvent);
  await wait(durationMs);
  socket.off(REALTIME_EVENT.CONVERSATION_STATE, onEvent);

  return received;
};

const buildUploadedSnapshot = () => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v13-s11.pdf",
    originalFileName: "v13-s11.pdf",
    mimeType: CANDIDATE_CV_UPLOADED_PDF.MIME_TYPE,
    sizeBytes: 2048,
    pageCount: 2,
  },
  capturedAt: CAPTURED_AT,
});

const createPublishedJob = async ({
  companyId,
  primaryMemberId,
  supportingMemberIds = [],
}) => {
  return Job.create({
    companyId,
    createdByCompanyMemberId: primaryMemberId,
    primaryRecruiterCompanyMemberId: primaryMemberId,
    supportingRecruiterCompanyMemberIds: supportingMemberIds,
    status: JOB_STATUS.PUBLISHED,
    publishedAt: new Date("2026-01-15"),
    applicationDeadline: FUTURE_DEADLINE(),
    title: "Backend Engineer",
    jobDescription: "Build APIs",
    requiredSkills: ["Node.js"],
    salaryText: "1000-2000",
    fieldCategoryIds: [],
    positionCategoryIds: [],
    location: null,
    employmentType: null,
    workModes: [],
    experienceLevelId: null,
  });
};

const createAssignedConversationFixture = async ({ emailPrefix }) => {
  const manager = await createActiveCompanyManagerContext({
    email: `${emailPrefix}.manager@example.com`,
    businessRegistrationNumber: `BRN-${emailPrefix.toUpperCase()}`,
  });
  const primary = await createActiveRecruiterContext({
    email: `${emailPrefix}.primary@example.com`,
    fullName: "Primary Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase()}-P`,
    jobTitle: "Lead Recruiter",
  });
  const secondary = await createActiveRecruiterContext({
    email: `${emailPrefix}.secondary@example.com`,
    fullName: "Secondary Recruiter",
    company: manager.company,
    employeeCode: `NV-${emailPrefix.toUpperCase()}-S`,
    jobTitle: "Secondary Recruiter",
  });
  const candidate = await createVerifiedUser({
    email: `${emailPrefix}.candidate@example.com`,
    fullName: "Conversation Candidate",
  });

  const job = await createPublishedJob({
    companyId: manager.company._id,
    primaryMemberId: primary.membership._id,
    supportingMemberIds: [secondary.membership._id],
  });

  const application = await Application.create({
    candidateUserId: candidate.user._id,
    jobId: job._id,
    source: APPLICATION_SOURCE.DIRECT_APPLICATION,
    status: APPLICATION_STATUS.APPLIED,
    submittedCvSnapshot: buildUploadedSnapshot(),
    appliedAt: APPLIED_AT,
    withdrawnAt: null,
    withdrawReason: null,
    assignedRecruiterCompanyMemberId: null,
    version: 0,
  });

  const assigned = await firstAssignApplication({
    actorUser: primary.user,
    jobId: job._id.toString(),
    applicationId: application._id.toString(),
    assigneeCompanyMemberId: primary.membership._id.toString(),
    expectedVersion: application.version,
  });

  const conversation = await Conversation.findOne({
    applicationId: assigned.application.id,
  });

  return {
    manager,
    primary,
    secondary,
    candidate,
    job,
    application: assigned.application,
    conversation,
  };
};

describe("V13 Slice 11 Conversation state realtime distribution", () => {
  let httpServer = null;
  let realtimePort = null;
  const openSockets = [];

  const startRealtimeTestServer = async () => {
    httpServer = http.createServer();
    const attachedIo = attachRealtimeDistribution(httpServer);
    realtimePort = await listenHttpServer(httpServer);

    return { io: attachedIo, port: realtimePort };
  };

  const trackSocket = (socket) => {
    openSockets.push(socket);

    return socket;
  };

  const disconnectTrackedSockets = async () => {
    await Promise.all(
      openSockets.splice(0).map(async (socket) => {
        if (socket.connected) {
          socket.disconnect();
        } else {
          socket.close();
        }
      }),
    );
  };

  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterEach(async () => {
    await disconnectTrackedSockets();
    await closeRealtimeDistribution();
    await closeListeningHttpServer(httpServer);
    httpServer = null;
    realtimePort = null;
    vi.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it("emits PAUSED_UNASSIGNED to the Candidate after manual Unassign", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice11-unassign",
    });
    await startRealtimeTestServer();

    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));

    await Promise.all([
      waitForConnect(candidateSocket),
      waitForConnect(assigneeSocket),
    ]);

    const candidateState = waitForConversationState(candidateSocket);
    const assigneeEvents = collectConversationStates(assigneeSocket);

    await unassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const payload = await candidateState;

    expect(payload.mode).toBe(CONVERSATION_REALTIME_MODE.PAUSED_UNASSIGNED);
    expect(payload.applicationId).toBe(fixture.application.id);
    expect(payload.conversationId).toBe(fixture.conversation._id.toString());
    expect(await assigneeEvents).toHaveLength(0);

    const durableEventTypes = await NotificationEvent.distinct("type", {
      applicationId: fixture.application.id,
    });
    expect(durableEventTypes).not.toContain("CONVERSATION_PAUSED_UNASSIGNED");
    expect(durableEventTypes).not.toContain("CONVERSATION_BECAME_WRITABLE");
    expect(durableEventTypes).not.toContain("CONVERSATION_BECAME_READ_ONLY");
  });

  it("emits WRITABLE to Candidate and new Assignee after Assign again", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice11-assign-again",
    });

    await unassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const unassigned = await Application.findById(fixture.application.id);
    await startRealtimeTestServer();

    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const assigneeToken = await issueAccessToken(fixture.secondary.user);
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));

    await Promise.all([
      waitForConnect(candidateSocket),
      waitForConnect(assigneeSocket),
    ]);

    const candidateState = waitForConversationState(candidateSocket);
    const assigneeState = waitForConversationState(assigneeSocket);

    await firstAssignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.secondary.membership._id.toString(),
      expectedVersion: unassigned.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const [candidatePayload, assigneePayload] = await Promise.all([
      candidateState,
      assigneeState,
    ]);

    expect(candidatePayload.mode).toBe(CONVERSATION_REALTIME_MODE.WRITABLE);
    expect(assigneePayload.mode).toBe(CONVERSATION_REALTIME_MODE.WRITABLE);
    expect(candidatePayload.conversationId).toBe(fixture.conversation._id.toString());
    expect(assigneePayload.conversationId).toBe(fixture.conversation._id.toString());
  });

  it("emits READ_ONLY after a terminal Recruitment Pipeline transition", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice11-terminal",
    });
    await startRealtimeTestServer();

    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));

    await Promise.all([
      waitForConnect(candidateSocket),
      waitForConnect(assigneeSocket),
    ]);

    const candidateState = waitForConversationState(candidateSocket);
    const assigneeState = waitForConversationState(assigneeSocket);

    await updateApplicationRecruitmentPipelineStatus({
      actorUser: fixture.primary.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      targetStatus: APPLICATION_STATUS.REJECTED,
      expectedStatus: APPLICATION_STATUS.APPLIED,
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const [candidatePayload, assigneePayload] = await Promise.all([
      candidateState,
      assigneeState,
    ]);

    expect(candidatePayload.mode).toBe(CONVERSATION_REALTIME_MODE.READ_ONLY);
    expect(assigneePayload.mode).toBe(CONVERSATION_REALTIME_MODE.READ_ONLY);
    expect(candidatePayload.applicationId).toBe(fixture.application.id);
  });

  it("does not emit a fake pause/resume cycle on Reassign A to B", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice11-reassign",
    });
    await startRealtimeTestServer();

    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const oldAssigneeToken = await issueAccessToken(fixture.primary.user);
    const newAssigneeToken = await issueAccessToken(fixture.secondary.user);

    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    const oldAssigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: oldAssigneeToken,
    }));
    const newAssigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: newAssigneeToken,
    }));

    await Promise.all([
      waitForConnect(candidateSocket),
      waitForConnect(oldAssigneeSocket),
      waitForConnect(newAssigneeSocket),
    ]);

    const candidateEvents = collectConversationStates(candidateSocket);
    const oldAssigneeEvents = collectConversationStates(oldAssigneeSocket);
    const newAssigneeEvents = collectConversationStates(newAssigneeSocket);

    await reassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.secondary.membership._id.toString(),
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    expect(await candidateEvents).toHaveLength(0);
    expect(await oldAssigneeEvents).toHaveLength(0);
    expect(await newAssigneeEvents).toHaveLength(0);
  });

  it("does not emit conversation state for a stale failed Unassign", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice11-stale-unassign",
    });
    await startRealtimeTestServer();

    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    await waitForConnect(candidateSocket);

    const candidateEvents = collectConversationStates(candidateSocket);

    await expect(
      unassignApplication({
        actorUser: fixture.manager.user,
        jobId: fixture.job._id.toString(),
        applicationId: fixture.application.id,
        expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
        expectedVersion: fixture.application.version + 99,
        clientCompanyId: fixture.manager.company._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(await candidateEvents).toHaveLength(0);
    const persisted = await Application.findById(fixture.application.id);
    expect(persisted.assignedRecruiterCompanyMemberId).not.toBeNull();
  });

  it("emits conversation state only after the source transition commits", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice11-commit-order",
    });
    await startRealtimeTestServer();

    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    await waitForConnect(candidateSocket);

    let releaseCommitGate;
    const commitGate = new Promise((resolve) => {
      releaseCommitGate = resolve;
    });
    const originalFindOneAndUpdate = Application.findOneAndUpdate.bind(Application);
    vi.spyOn(Application, "findOneAndUpdate").mockImplementation(async (...args) => {
      const filter = args[0] ?? {};
      const update = args[1] ?? {};
      const isUnassignMutation =
        filter.assignedRecruiterCompanyMemberId != null &&
        update?.$set?.assignedRecruiterCompanyMemberId === null;

      if (isUnassignMutation) {
        await commitGate;
      }

      return originalFindOneAndUpdate(...args);
    });

    const candidateEvents = collectConversationStates(candidateSocket, 400);
    const receivedAfterCommit = waitForConversationState(candidateSocket);
    const unassignPromise = unassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    await wait(100);
    expect(await Application.findById(fixture.application.id)).toMatchObject({
      assignedRecruiterCompanyMemberId: fixture.primary.membership._id,
    });
    expect(await candidateEvents).toHaveLength(0);

    releaseCommitGate();
    await unassignPromise;
    const payload = await receivedAfterCommit;

    expect(payload.mode).toBe(CONVERSATION_REALTIME_MODE.PAUSED_UNASSIGNED);
    expect(await Application.findById(fixture.application.id)).toMatchObject({
      assignedRecruiterCompanyMemberId: null,
    });
  });

  it("does not deliver conversation state to the old Assignee after Unassign", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice11-old-assignee",
    });
    await startRealtimeTestServer();

    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    await waitForConnect(assigneeSocket);

    const assigneeEvents = collectConversationStates(assigneeSocket);

    await automaticallyUnassignApplication({
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    expect(await assigneeEvents).toHaveLength(0);
  });

  it("fans out conversation state to every active session of each recipient", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice11-multi-session",
    });
    await startRealtimeTestServer();

    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const firstCandidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    const secondCandidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));

    await Promise.all([
      waitForConnect(firstCandidateSocket),
      waitForConnect(secondCandidateSocket),
    ]);

    const firstState = waitForConversationState(firstCandidateSocket);
    const secondState = waitForConversationState(secondCandidateSocket);

    await unassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const [firstPayload, secondPayload] = await Promise.all([
      firstState,
      secondState,
    ]);

    expect(firstPayload.mode).toBe(CONVERSATION_REALTIME_MODE.PAUSED_UNASSIGNED);
    expect(secondPayload.mode).toBe(CONVERSATION_REALTIME_MODE.PAUSED_UNASSIGNED);
  });

  it("does not roll back Unassign when Socket emit fails", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice11-socket-failure",
    });
    const { io: attachedIo } = await startRealtimeTestServer();

    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    await waitForConnect(candidateSocket);

    vi.spyOn(attachedIo, "to").mockImplementation(() => {
      throw new Error("socket adapter failure");
    });

    const candidateEvents = collectConversationStates(candidateSocket);

    await unassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    expect(await candidateEvents).toHaveLength(0);
    expect(await Application.findById(fixture.application.id)).toMatchObject({
      assignedRecruiterCompanyMemberId: null,
    });

    vi.mocked(attachedIo.to).mockRestore();

    const unassigned = await Application.findById(fixture.application.id);
    const candidateState = waitForConversationState(candidateSocket);

    await firstAssignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.secondary.membership._id.toString(),
      expectedVersion: unassigned.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const payload = await candidateState;
    expect(payload.mode).toBe(CONVERSATION_REALTIME_MODE.WRITABLE);
  });
});
