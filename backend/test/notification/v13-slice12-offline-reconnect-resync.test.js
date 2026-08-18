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
import NOTIFICATION_TYPE from "../../src/constants/notification-type.js";
import REALTIME_EVENT from "../../src/constants/realtime-event.js";
import AuthSession from "../../src/models/auth-session.model.js";
import Application from "../../src/models/application.model.js";
import Job from "../../src/models/job.model.js";
import Message from "../../src/models/message.model.js";
import Notification from "../../src/models/notification.model.js";
import NotificationEvent from "../../src/models/notification-event.model.js";
import {
  firstAssignApplication,
  sendRecruiterApplicationConversationNormalMessage,
  unassignApplication,
} from "../../src/services/application.service.js";
import {
  createNotificationEvent,
  materializeNotificationEvent,
} from "../../src/services/notification.service.js";
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
  DEFAULT_PASSWORD,
  loginAndGetAccessToken,
} from "../helpers/auth-fixtures.js";
import {
  clearDatabase,
  connectTestDatabase,
  createTestAgent,
  disconnectTestDatabase,
} from "../helpers/database.js";

const objectId = () => new mongoose.Types.ObjectId();
const FUTURE_DEADLINE = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const APPLIED_AT = new Date("2026-08-14T10:00:01.000Z");
const CAPTURED_AT = new Date("2026-08-14T10:00:00.000Z");

const FORBIDDEN_OFFLINE_SYNC_PERSISTENCE_NAMES = [
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

const waitForRealtimeEvent = (socket, eventName, timeoutMs = 2_000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };

    socket.once(eventName, onEvent);
  });
};

const collectRealtimeEvents = async (socket, eventName, durationMs = 250) => {
  const received = [];
  const onEvent = (payload) => {
    received.push(payload);
  };

  socket.on(eventName, onEvent);
  await wait(durationMs);
  socket.off(eventName, onEvent);

  return received;
};

const buildUploadedSnapshot = () => ({
  sourceCandidateCvId: new mongoose.Types.ObjectId(),
  name: "Submitted CV Snapshot",
  sourceType: CANDIDATE_CV_SOURCE_TYPE.UPLOADED,
  pdfFile: {
    storageKey: "applications/submitted-cv-snapshots/v13-s12.pdf",
    originalFileName: "v13-s12.pdf",
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

describe("V13 Slice 12 Offline / Reconnect Resync", () => {
  let httpServer = null;
  let realtimePort = null;
  const openSockets = [];

  const startRealtimeTestServer = async () => {
    httpServer = http.createServer();
    attachRealtimeDistribution(httpServer);
    realtimePort = await listenHttpServer(httpServer);
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

  it("resyncs missed Notification from durable inbox HTTP without Socket replay on reconnect", async () => {
    const agent = createTestAgent();
    const recipient = await createVerifiedUser({
      email: "slice12-notif-resync@example.com",
    });
    const accessToken = await loginAndGetAccessToken(agent, {
      email: recipient.user.email,
      password: DEFAULT_PASSWORD,
    });
    const socketToken = await issueAccessToken(recipient.user);
    await startRealtimeTestServer();

    const { event } = await createNotificationEvent({
      eventKey: `slice12:${objectId()}`,
      type: NOTIFICATION_TYPE.APPLICATION_UNASSIGNED,
      applicationId: objectId(),
      recipients: [{
        recipientUserId: recipient.user._id,
        content: "Created while recipient was offline",
      }],
    });
    await materializeNotificationEvent({ eventId: event._id });

    const inbox = await agent
      .get("/api/notifications")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(inbox.status).toBe(200);
    expect(inbox.body.unreadCount).toBe(1);
    expect(inbox.body.notifications).toHaveLength(1);
    expect(inbox.body.notifications[0].content).toBe("Created while recipient was offline");

    const reconnected = trackSocket(openSocket({
      port: realtimePort,
      accessToken: socketToken,
    }));
    await waitForConnect(reconnected);
    expect(await collectRealtimeEvents(reconnected, REALTIME_EVENT.NOTIFICATION)).toHaveLength(0);

    const liveNotification = waitForRealtimeEvent(
      reconnected,
      REALTIME_EVENT.NOTIFICATION,
    );
    const { event: liveEvent } = await createNotificationEvent({
      eventKey: `slice12:${objectId()}`,
      type: NOTIFICATION_TYPE.APPLICATION_ASSIGNED,
      applicationId: objectId(),
      recipients: [{
        recipientUserId: recipient.user._id,
        content: "Created after reconnect",
      }],
    });
    await materializeNotificationEvent({ eventId: liveEvent._id });
    const payload = await liveNotification;

    expect(payload.notification.content).toBe("Created after reconnect");
    expect(await Notification.countDocuments({
      recipientUserId: recipient.user._id,
    })).toBe(2);
  });

  it("resyncs missed Message from canonical Conversation HTTP read without Socket replay", async () => {
    const agent = createTestAgent();
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice12-message-resync",
    });
    const candidateToken = await loginAndGetAccessToken(agent, {
      email: fixture.candidate.user.email,
      password: DEFAULT_PASSWORD,
    });
    const candidateSocketToken = await issueAccessToken(fixture.candidate.user);
    await startRealtimeTestServer();

    await sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "Message while Candidate was offline",
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const conversation = await agent
      .get(`/api/candidate/applications/${fixture.application.id}/conversation`)
      .set("Authorization", `Bearer ${candidateToken}`);

    expect(conversation.status).toBe(200);
    expect(conversation.body.messages.map((message) => message.content)).toContain(
      "Message while Candidate was offline",
    );

    const reconnected = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateSocketToken,
    }));
    await waitForConnect(reconnected);
    expect(await collectRealtimeEvents(reconnected, REALTIME_EVENT.MESSAGE)).toHaveLength(0);

    const liveMessage = waitForRealtimeEvent(reconnected, REALTIME_EVENT.MESSAGE);
    await sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "Message after reconnect",
      clientCompanyId: fixture.manager.company._id.toString(),
    });
    const payload = await liveMessage;

    expect(payload.message.content).toBe("Message after reconnect");
    expect(await Message.countDocuments()).toBe(2);
  });

  it("resyncs current Conversation interaction mode from authoritative HTTP read after missed state transition", async () => {
    const agent = createTestAgent();
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice12-state-resync",
    });
    const candidateToken = await loginAndGetAccessToken(agent, {
      email: fixture.candidate.user.email,
      password: DEFAULT_PASSWORD,
    });
    const candidateSocketToken = await issueAccessToken(fixture.candidate.user);
    await startRealtimeTestServer();

    await unassignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      expectedAssigneeCompanyMemberId: fixture.primary.membership._id.toString(),
      expectedVersion: fixture.application.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const conversation = await agent
      .get(`/api/candidate/applications/${fixture.application.id}/conversation`)
      .set("Authorization", `Bearer ${candidateToken}`);

    expect(conversation.status).toBe(200);
    expect(conversation.body.conversation.mode).toBe("PAUSED_UNASSIGNED");
    expect(conversation.body.authority.canSendNormal).toBe(false);

    const reconnected = trackSocket(openSocket({
      port: realtimePort,
      accessToken: candidateSocketToken,
    }));
    await waitForConnect(reconnected);
    expect(
      await collectRealtimeEvents(reconnected, REALTIME_EVENT.CONVERSATION_STATE),
    ).toHaveLength(0);

    const liveState = waitForRealtimeEvent(
      reconnected,
      REALTIME_EVENT.CONVERSATION_STATE,
    );
    const unassigned = await Application.findById(fixture.application.id);
    await firstAssignApplication({
      actorUser: fixture.manager.user,
      jobId: fixture.job._id.toString(),
      applicationId: fixture.application.id,
      assigneeCompanyMemberId: fixture.secondary.membership._id.toString(),
      expectedVersion: unassigned.version,
      clientCompanyId: fixture.manager.company._id.toString(),
    });
    const payload = await liveState;

    expect(payload.mode).toBe("WRITABLE");

    const writableConversation = await agent
      .get(`/api/candidate/applications/${fixture.application.id}/conversation`)
      .set("Authorization", `Bearer ${candidateToken}`);

    expect(writableConversation.body.conversation.mode).toBe("ACTIVE");
    expect(writableConversation.body.authority.canSendNormal).toBe(true);
  });

  it("does not duplicate durable Notification or Message data across multiple reconnects", async () => {
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice12-no-dup",
    });
    const candidateSocketToken = await issueAccessToken(fixture.candidate.user);
    await startRealtimeTestServer();

    const { event } = await createNotificationEvent({
      eventKey: `slice12:${objectId()}`,
      type: NOTIFICATION_TYPE.CHAT_MESSAGE_CREATED,
      applicationId: fixture.application.id,
      messageId: objectId(),
      recipients: [{
        recipientUserId: fixture.candidate.user._id,
        content: "Offline chat notification",
      }],
    });
    await materializeNotificationEvent({ eventId: event._id });

    await sendRecruiterApplicationConversationNormalMessage({
      actorUser: fixture.primary.user,
      applicationId: fixture.application.id,
      content: "Offline durable message",
      clientCompanyId: fixture.manager.company._id.toString(),
    });

    const notificationCountBefore = await Notification.countDocuments({
      recipientUserId: fixture.candidate.user._id,
    });
    const messageCountBefore = await Message.countDocuments();
    const eventCountBefore = await NotificationEvent.countDocuments();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const socket = trackSocket(openSocket({
        port: realtimePort,
        accessToken: candidateSocketToken,
      }));
      await waitForConnect(socket);
      expect(await collectRealtimeEvents(socket, REALTIME_EVENT.NOTIFICATION)).toHaveLength(0);
      expect(await collectRealtimeEvents(socket, REALTIME_EVENT.MESSAGE)).toHaveLength(0);
      socket.disconnect();
      await wait(30);
    }

    expect(await Notification.countDocuments({
      recipientUserId: fixture.candidate.user._id,
    })).toBe(notificationCountBefore);
    expect(await Message.countDocuments()).toBe(messageCountBefore);
    expect(await NotificationEvent.countDocuments()).toBe(eventCountBefore);
  });

  it("denies cross-user HTTP resync reads for Notification inbox and Conversation", async () => {
    const agent = createTestAgent();
    const fixture = await createAssignedConversationFixture({
      emailPrefix: "slice12-auth",
    });
    const ownerToken = await loginAndGetAccessToken(agent, {
      email: fixture.candidate.user.email,
      password: DEFAULT_PASSWORD,
    });
    const intruder = await createVerifiedUser({
      email: "slice12-intruder@example.com",
    });
    const intruderToken = await loginAndGetAccessToken(agent, {
      email: intruder.user.email,
      password: DEFAULT_PASSWORD,
    });

    const { event } = await createNotificationEvent({
      eventKey: `slice12:${objectId()}`,
      type: NOTIFICATION_TYPE.APPLICATION_ASSIGNED,
      applicationId: fixture.application.id,
      recipients: [{
        recipientUserId: fixture.candidate.user._id,
        content: "Owner-only notification",
      }],
    });
    await materializeNotificationEvent({ eventId: event._id });
    const durable = await Notification.findOne({ eventId: event._id });

    const ownerInbox = await agent
      .get("/api/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);
    const intruderInbox = await agent
      .get("/api/notifications")
      .set("Authorization", `Bearer ${intruderToken}`);
    const intruderFetch = await agent
      .get(`/api/notifications/${durable._id}`)
      .set("Authorization", `Bearer ${intruderToken}`);
    const ownerConversation = await agent
      .get(`/api/candidate/applications/${fixture.application.id}/conversation`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const intruderConversation = await agent
      .get(`/api/candidate/applications/${fixture.application.id}/conversation`)
      .set("Authorization", `Bearer ${intruderToken}`);

    expect(ownerInbox.status).toBe(200);
    expect(
      ownerInbox.body.notifications.some(
        (notification) => notification._id === durable._id.toString(),
      ),
    ).toBe(true);
    expect(intruderInbox.status).toBe(200);
    expect(intruderInbox.body.notifications).toHaveLength(0);
    expect(intruderFetch.status).toBe(404);
    expect(ownerConversation.status).toBe(200);
    expect(intruderConversation.status).toBe(404);
  });

  it("does not persist offline sync state, replay queues, or delivery/session infrastructure", async () => {
    await startRealtimeTestServer();

    const modelNames = mongoose.modelNames().map((name) => name.toLowerCase());
    const collectionNames = Object.keys(mongoose.connection.collections).map(
      (name) => name.toLowerCase(),
    );

    for (const name of FORBIDDEN_OFFLINE_SYNC_PERSISTENCE_NAMES) {
      expect(modelNames).not.toContain(name);
      expect(collectionNames).not.toContain(name);
    }

    expect(Notification.schema.path("socketId")).toBeUndefined();
    expect(Notification.schema.path("deliveredAt")).toBeUndefined();
    expect(Message.schema.path("deliveredAt")).toBeUndefined();
    expect(Message.schema.path("socketEventId")).toBeUndefined();
  });
});
