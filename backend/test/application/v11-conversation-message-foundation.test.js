import mongoose from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import MESSAGE_TYPE from "../../src/constants/message-type.js";
import Conversation from "../../src/models/conversation.model.js";
import Message, {
  assertMessageLocalInvariants,
} from "../../src/models/message.model.js";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../helpers/database.js";

const FORBIDDEN_CONVERSATION_FIELDS = [
  "candidateUserId",
  "assignedRecruiterCompanyMemberId",
  "jobId",
  "companyId",
  "status",
  "chatState",
  "isReadOnly",
  "participants",
  "updatedAt",
];

const findIndexByKey = (indexes, key) => {
  return indexes.find((index) => {
    const indexKey = index.key;
    const expectedKeys = Object.keys(key);

    return (
      Object.keys(indexKey).length === expectedKeys.length &&
      expectedKeys.every((field) => indexKey[field] === key[field])
    );
  });
};

describe("V11 Slice 01 — Conversation & Message persistence foundation", () => {
  beforeAll(async () => {
    await connectTestDatabase();
    await Conversation.syncIndexes();
    await Message.syncIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe("Conversation", () => {
    it("persists applicationId uniqueness and createdAt without duplicated Application state", async () => {
      const applicationId = new mongoose.Types.ObjectId();
      const conversation = await Conversation.create({
        applicationId,
        candidateUserId: new mongoose.Types.ObjectId(),
        assignedRecruiterCompanyMemberId: new mongoose.Types.ObjectId(),
        jobId: new mongoose.Types.ObjectId(),
        companyId: new mongoose.Types.ObjectId(),
        status: "ACTIVE",
        chatState: "ACTIVE",
        isReadOnly: true,
        participants: [{ role: "CANDIDATE" }],
      });

      const persisted = await Conversation.findById(conversation._id).lean();

      expect(String(persisted.applicationId)).toBe(applicationId.toString());
      expect(persisted.createdAt).toBeInstanceOf(Date);
      for (const field of FORBIDDEN_CONVERSATION_FIELDS) {
        expect(persisted).not.toHaveProperty(field);
      }

      await expect(
        Conversation.create({ applicationId }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it("declares a unique applicationId index", async () => {
      const indexes = await Conversation.collection.indexes();
      const applicationIdIndex = findIndexByKey(indexes, { applicationId: 1 });

      expect(applicationIdIndex).toBeDefined();
      expect(applicationIdIndex.unique).toBe(true);
    });

    it("rejects Conversation documents without applicationId", async () => {
      await expect(Conversation.create({})).rejects.toBeInstanceOf(
        mongoose.Error.ValidationError,
      );
    });

    it("rejects query updates because Conversation has no mutable business state", async () => {
      const conversation = await Conversation.create({
        applicationId: new mongoose.Types.ObjectId(),
      });

      await expect(
        Conversation.updateOne(
          { _id: conversation._id },
          { $set: { applicationId: new mongoose.Types.ObjectId() } },
        ),
      ).rejects.toThrow("Conversation documents are immutable after creation");
    });
  });

  describe("Message", () => {
    it("allows a Conversation to exist with zero Messages", async () => {
      const conversation = await Conversation.create({
        applicationId: new mongoose.Types.ObjectId(),
      });

      await expect(
        Message.countDocuments({ conversationId: conversation._id }),
      ).resolves.toBe(0);
    });

    it("persists NORMAL Candidate, NORMAL Recruiter, and SYSTEM sender matrices", async () => {
      const conversation = await Conversation.create({
        applicationId: new mongoose.Types.ObjectId(),
      });
      const candidateUserId = new mongoose.Types.ObjectId();
      const recruiterUserId = new mongoose.Types.ObjectId();
      const recruiterCompanyMemberId = new mongoose.Types.ObjectId();

      const candidateMessage = await Message.create({
        conversationId: conversation._id,
        type: MESSAGE_TYPE.NORMAL,
        senderUserId: candidateUserId,
        content: "Candidate hello",
      });
      const recruiterMessage = await Message.create({
        conversationId: conversation._id,
        type: MESSAGE_TYPE.NORMAL,
        senderUserId: recruiterUserId,
        senderCompanyMemberId: recruiterCompanyMemberId,
        content: "Recruiter hello",
      });
      const systemMessage = await Message.create({
        conversationId: conversation._id,
        type: MESSAGE_TYPE.SYSTEM,
        content: "Responsibility changed",
      });

      const persistedCandidate = await Message.findById(
        candidateMessage._id,
      ).lean();
      const persistedRecruiter = await Message.findById(
        recruiterMessage._id,
      ).lean();
      const persistedSystem = await Message.findById(systemMessage._id).lean();

      expect(persistedCandidate).toMatchObject({
        type: MESSAGE_TYPE.NORMAL,
        content: "Candidate hello",
        senderCompanyMemberId: null,
      });
      expect(String(persistedCandidate.senderUserId)).toBe(
        candidateUserId.toString(),
      );

      expect(persistedRecruiter.type).toBe(MESSAGE_TYPE.NORMAL);
      expect(String(persistedRecruiter.senderUserId)).toBe(
        recruiterUserId.toString(),
      );
      expect(String(persistedRecruiter.senderCompanyMemberId)).toBe(
        recruiterCompanyMemberId.toString(),
      );

      expect(persistedSystem).toMatchObject({
        type: MESSAGE_TYPE.SYSTEM,
        senderUserId: null,
        senderCompanyMemberId: null,
        content: "Responsibility changed",
      });
      expect(persistedSystem.createdAt).toBeInstanceOf(Date);
      expect(persistedSystem).not.toHaveProperty("updatedAt");
    });

    it("keeps historical sender identity after later Application assignee change", async () => {
      const conversation = await Conversation.create({
        applicationId: new mongoose.Types.ObjectId(),
      });
      const originalSenderUserId = new mongoose.Types.ObjectId();
      const originalSenderCompanyMemberId = new mongoose.Types.ObjectId();
      const message = await Message.create({
        conversationId: conversation._id,
        type: MESSAGE_TYPE.NORMAL,
        senderUserId: originalSenderUserId,
        senderCompanyMemberId: originalSenderCompanyMemberId,
        content: "Historical sender",
      });

      await expect(
        Message.updateOne(
          { _id: message._id },
          { $set: { senderUserId: new mongoose.Types.ObjectId() } },
        ),
      ).rejects.toThrow("Message documents are immutable after creation");

      const persisted = await Message.findById(message._id).lean();
      expect(String(persisted.senderUserId)).toBe(
        originalSenderUserId.toString(),
      );
      expect(String(persisted.senderCompanyMemberId)).toBe(
        originalSenderCompanyMemberId.toString(),
      );
    });

    it("rejects SYSTEM senders, NORMAL without senderUserId, and unknown types", async () => {
      expect(
        assertMessageLocalInvariants({
          type: MESSAGE_TYPE.SYSTEM,
          senderUserId: new mongoose.Types.ObjectId(),
          senderCompanyMemberId: null,
        }),
      ).toEqual(["SYSTEM Message must not have senderUserId"]);
      expect(
        assertMessageLocalInvariants({
          type: MESSAGE_TYPE.NORMAL,
          senderUserId: null,
          senderCompanyMemberId: null,
        }),
      ).toEqual(["NORMAL Message must have senderUserId"]);

      const conversationId = new mongoose.Types.ObjectId();

      await expect(
        Message.create({
          conversationId,
          type: MESSAGE_TYPE.SYSTEM,
          senderUserId: new mongoose.Types.ObjectId(),
          content: "Invalid system",
        }),
      ).rejects.toBeInstanceOf(mongoose.Error.ValidationError);

      await expect(
        Message.create({
          conversationId,
          type: MESSAGE_TYPE.NORMAL,
          content: "Missing sender",
        }),
      ).rejects.toBeInstanceOf(mongoose.Error.ValidationError);

      await expect(
        Message.create({
          conversationId,
          type: "ASSIGNED",
          content: "Unknown type",
        }),
      ).rejects.toBeInstanceOf(mongoose.Error.ValidationError);

      await expect(
        Message.create({
          conversationId,
          type: MESSAGE_TYPE.NORMAL,
          senderUserId: new mongoose.Types.ObjectId(),
          content: "   ",
        }),
      ).rejects.toBeInstanceOf(mongoose.Error.ValidationError);
    });

    it("declares a conversationId + createdAt history index", async () => {
      const indexes = await Message.collection.indexes();
      const historyIndex = findIndexByKey(indexes, {
        conversationId: 1,
        createdAt: -1,
      });

      expect(historyIndex).toBeDefined();
      expect(historyIndex.unique).not.toBe(true);
    });
  });
});
