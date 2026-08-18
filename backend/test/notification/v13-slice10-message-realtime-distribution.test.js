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
import JOB_STATUS from "../../src/constants/job-status.js";
import MESSAGE_TYPE from "../../src/constants/message-type.js";
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import REALTIME_EVENT from "../../src/constants/realtime-event.js";
import AuthSession from "../../src/models/auth-session.model.js";
import Application from "../../src/models/application.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import Notification from "../../src/models/notification.model.js";
import {
  automaticallyUnassignApplication,
  firstAssignApplication,
  reassignApplication,
  sendCandidateApplicationConversationNormalMessage,
  sendRecruiterApplicationConversationNormalMessage,
  unassignApplication,
} from "../../src/services/application.service.js";
import { materializeNotificationEvent } from "../../src/services/notification.service.js";
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

const FORBIDDEN_REALTIME_PERSISTENCE_NAMES = [
  "socketsession",
  "socketsessions",
  "socketconnection",
  "socketconnections",
  "notificationdelivery",
  "notificationdeliveries",
  "realtimeevent",
  "realtimeevents",
  "messagedelivery",
  "messagedeliveries",
  "messagereadreceipt",
  "messagereadreceipts",
  "onlinepresence",
  "onlinepresences",
];

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

const waitForMessage = (socket, timeoutMs = 2_000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(REALTIME_EVENT.MESSAGE, onEvent);
      reject(new Error("Timed out waiting for message realtime event"));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(REALTIME_EVENT.MESSAGE, onEvent);
  });
};

const collectMessages = async (socket, durationMs = 250) => {
  const received = [];
  const onEvent = (payload) => {
    received.push(payload);
  };

  socket.on(REALTIME_EVENT.MESSAGE, onEvent);
  await wait(durationMs);
  socket.off(REALTIME_EVENT.MESSAGE, onEvent);

  return received;
};

const buildUploadedSnapshot = () => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v13-s10.pdf",
    originalFileName: "v13-s10.pdf",
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

  return {
    manager,
    primary,
    secondary,
    candidate,
    job,
    application: assigned.application,
  };
};

describe("V13 Slice 10 Message realtime distribution", () => {
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

  it("delivers Candidate NORMAL Message realtime only to the current Assignee", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-candidate-send",
    });
    const { io: attachedIo } = await startRealtimeTestServer();
    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const otherToken = await issueAccessToken(fixture.secondary.user);

    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    const otherSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: otherToken,
    }));

    await Promise.all([
      waitForConnect(assigneeSocket),
      waitForConnect(candidateSocket),
      waitForConnect(otherSocket),
    ]);

    const assigneeMessage = waitForMessage(assigneeSocket);
    const candidateMessages = collectMessages(candidateSocket);
    const otherMessages = collectMessages(otherSocket);

    const sendResult = await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "Hello from Candidate",
    });

    const [payload, senderEvents, leaked] = await Promise.all([
      assigneeMessage,
      candidateMessages,
      otherMessages,
    ]);
    const persisted = await Message.findById(sendResult.message.id);
    const chatEvent = await NotificationEvent.findOne({
      messageId: persisted._id,
      type: NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED,
    });

    expect(persisted).not.toBeNull();
    expect(chatEvent).not.toBeNull();
    expect(payload.message.id).toBe(sendResult.message.id);
    expect(payload.message.content).toBe("Hello from Candidate");
    expect(payload.applicationId).toBe(fixture.application.id);
    expect(senderEvents).toHaveLength(0);
    expect(leaked).toHaveLength(0);
    expect(attachedIo).toBeTruthy();
  });

  it("delivers Recruiter NORMAL Message realtime only to the Candidate owner", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-recruiter-send",
    });
    await startRealtimeTestServer();
    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const candidateToken = await issueAccessToken(fixture.candidate.user);

    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    const firstCandidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    const secondCandidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));

    await Promise.all([
      waitForConnect(assigneeSocket),
      waitForConnect(firstCandidateSocket),
      waitForConnect(secondCandidateSocket),
    ]);

    const firstCandidateMessage = waitForMessage(firstCandidateSocket);
    const secondCandidateMessage = waitForMessage(secondCandidateSocket);
    const assigneeMessages = collectMessages(assigneeSocket);

    const sendResult = await sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "Hello from Recruiter",
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const [firstPayload, secondPayload, senderEvents] = await Promise.all([
      firstCandidateMessage,
      secondCandidateMessage,
      assigneeMessages,
    ]);

    expect(firstPayload.message.id).toBe(sendResult.message.id);
    expect(secondPayload.message.id).toBe(sendResult.message.id);
    expect(firstPayload.message.type).toBe(MESSAGE_TYPE.NORMAL);
    expect(senderEvents).toHaveLength(0);
  });

  it("does not deliver Message realtime to an old Assignee after Reassign", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-reassign",
    });
    await startRealtimeTestServer();

    const oldAssigneeToken = await issueAccessToken(fixture.primary.user);
    const newAssigneeToken = await issueAccessToken(fixture.secondary.user);
    const candidateToken = await issueAccessToken(fixture.candidate.user);

    const oldAssigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: oldAssigneeToken,
    }));
    const newAssigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: newAssigneeToken,
    }));
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));

    await Promise.all([
      waitForConnect(oldAssigneeSocket),
      waitForConnect(newAssigneeSocket),
      waitForConnect(candidateSocket),
    ]);

    const systemForCandidate = waitForMessage(candidateSocket);
    const systemForNewAssignee = waitForMessage(newAssigneeSocket);
    const oldAssigneeDuringSystem = collectMessages(oldAssigneeSocket);

    const reassignResult = await reassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.secondary.membership._id.toString(),
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    await Promise.all([systemForCandidate, systemForNewAssignee]);
    expect(await oldAssigneeDuringSystem).toHaveLength(0);

    const newAssigneeNormal = waitForMessage(newAssigneeSocket);
    const oldAssigneeNormal = collectMessages(oldAssigneeSocket);
    const candidateNormal = collectMessages(candidateSocket);

    await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: reassignResult.application.id,
      content: "After reassign",
    });

    await newAssigneeNormal;
    expect(await oldAssigneeNormal).toHaveLength(0);
    expect(await candidateNormal).toHaveLength(0);
  });

  it("delivers SYSTEM Message realtime to valid post-transition participants only", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-system-unassign",
    });
    await startRealtimeTestServer();

    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const candidateToken = await issueAccessToken(fixture.candidate.user);

    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));

    await Promise.all([
      waitForConnect(assigneeSocket),
      waitForConnect(candidateSocket),
    ]);

    const candidateSystem = waitForMessage(candidateSocket);
    const assigneeAfterUnassign = collectMessages(assigneeSocket);

    await unassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const payload = await candidateSystem;

    expect(payload.message.type).toBe(MESSAGE_TYPE.SYSTEM);
    expect(payload.applicationId).toBe(fixture.application.id);
    expect(await assigneeAfterUnassign).toHaveLength(0);
  });

  it("does not emit Message realtime for unauthorized NORMAL sends", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-unauthorized",
    });
    await startRealtimeTestServer();

    await unassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    await Promise.all([
      waitForConnect(assigneeSocket),
      waitForConnect(candidateSocket),
    ]);

    const assigneeEvents = collectMessages(assigneeSocket);
    const candidateEvents = collectMessages(candidateSocket);

    await expect(
      sendCandidateApplicationConversationNormalMessage({
        candidateUserId: fixture.candidate.user._id,
        actorUser: fixture.candidate.user,
        applicationId: fixture.application.id,
        content: "Should fail while UNASSIGNED",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    await expect(
      sendRecruiterApplicationConversationNormalMessage({
        actorUser: fixture.primary.user,
        applicationId: fixture.application.id,
        content: "Should fail while UNASSIGNED",
        clientCompanyId: fixture.manager.company._id.toString(),
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(await assigneeEvents).toHaveLength(0);
    expect(await candidateEvents).toHaveLength(0);
    expect(await Message.countDocuments({
      content: "Should fail while UNASSIGNED",
    })).toBe(0);
  });

  it("emits Message realtime only after the Message commit succeeds", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-commit-order",
    });
    await startRealtimeTestServer();
    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    await waitForConnect(assigneeSocket);

    let releaseCreateGate;
    const createGate = new Promise((resolve) => {
      releaseCreateGate = resolve;
    });
    const originalCreate = Message.create.bind(Message);
    vi.spyOn(Message, "create").mockImplementation(async (...args) => {
      await createGate;
      return originalCreate(...args);
    });

    const assigneeEvents = collectMessages(assigneeSocket, 400);
    const receivedAfterCommit = waitForMessage(assigneeSocket);
    const sendPromise = sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "Commit-order probe",
    });

    await wait(100);
    expect(await Message.countDocuments({ content: "Commit-order probe" })).toBe(0);
    expect(await assigneeEvents).toHaveLength(0);

    releaseCreateGate();
    const sendResult = await sendPromise;
    const payload = await receivedAfterCommit;

    expect(sendResult.message.content).toBe("Commit-order probe");
    expect(payload.message.id).toBe(sendResult.message.id);
    expect(await Message.findById(sendResult.message.id)).not.toBeNull();
  });

  it("does not roll back persisted Message when Socket emit fails", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-socket-failure",
    });
    const { io: attachedIo } = await startRealtimeTestServer();
    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    await waitForConnect(assigneeSocket);

    vi.spyOn(attachedIo, "to").mockImplementation(() => {
      throw new Error("socket adapter failure");
    });

    const sendResult = await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "Persist despite socket failure",
    });
    const leaked = await collectMessages(assigneeSocket);

    const persisted = await Message.findById(sendResult.message.id);
    const chatEvent = await NotificationEvent.findOne({
      messageId: persisted._id,
      type: NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED,
    });

    expect(persisted).not.toBeNull();
    expect(persisted.content).toBe("Persist despite socket failure");
    expect(chatEvent).not.toBeNull();
    expect(leaked).toHaveLength(0);

    vi.mocked(attachedIo.to).mockRestore();

    const recovered = waitForMessage(assigneeSocket);
    await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "After adapter recovery",
    });
    const payload = await recovered;
    expect(payload.message.content).toBe("After adapter recovery");
  });

  it("keeps durable CHAT_MESSAGE_CREATED obligations while adding Message realtime", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-durable-regression",
    });
    await startRealtimeTestServer();
    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    await waitForConnect(assigneeSocket);
    const received = waitForMessage(assigneeSocket);

    const sendResult = await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "Durable plus realtime",
    });

    await received;
    const chatEvent = await NotificationEvent.findOne({
      messageId: sendResult.message.id,
      type: NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED,
    });
    await materializeNotificationEvent({ eventId: chatEvent._id });
    const durable = await Notification.findOne({
      eventId: chatEvent._id,
      recipientUserId: fixture.primary.user._id,
    });

    expect(durable).not.toBeNull();
    expect(durable.messageId.toString()).toBe(sendResult.message.id);
    expect(durable.readAt).toBeNull();
  });

  it("delivers automatic Unassign SYSTEM Message realtime to the Candidate only", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-auto-unassign",
    });
    await startRealtimeTestServer();

    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const candidateToken = await issueAccessToken(fixture.candidate.user);
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    const candidateSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateToken,
    }));
    await Promise.all([
      waitForConnect(assigneeSocket),
      waitForConnect(candidateSocket),
    ]);

    const candidateSystem = waitForMessage(candidateSocket);
    const assigneeEvents = collectMessages(assigneeSocket);

    await automaticallyUnassignApplication({
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
    });

    const payload = await candidateSystem;

    expect(payload.message.type).toBe(MESSAGE_TYPE.SYSTEM);
    expect(await assigneeEvents).toHaveLength(0);
  });

  it("does not persist Message delivery/session state for realtime fan-out", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice10-no-delivery-persist",
    });
    await startRealtimeTestServer();
    const assigneeToken = await issueAccessToken(fixture.primary.user);
    const assigneeSocket = trackSocket(openSocket({
      port: realtimePort,
      accessToken: assigneeToken,
    }));
    await waitForConnect(assigneeSocket);
    const received = waitForMessage(assigneeSocket);

    await sendCandidateApplicationConversationNormalMessage({
      candidateUserId: fixture.candidate.user._id,
      actorUser: fixture.candidate.user,
      applicationId: fixture.application.id,
      content: "No delivery persistence",
    });
    await received;

    const modelNames = mongoose.modelNames().map((name) => name.toLowerCase());
    const collectionNames = Object.keys(mongoose.connection.collections).map(
      (name) => name.toLowerCase(),
    );

    for (const name of FORBIDDEN_REALTIME_PERSISTENCE_NAMES) {
      expect(modelNames).not.toContain(name);
      expect(collectionNames).not.toContain(name);
    }
    expect(Message.schema.path("deliveredAt")).toBeUndefined();
    expect(Message.schema.path("deliveryStatus")).toBeUndefined();
  });
});
