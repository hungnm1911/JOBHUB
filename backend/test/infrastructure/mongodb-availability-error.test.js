import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import AppError from "../../src/utils/app-error.js";
import { isMongoDbAvailabilityError } from "../../src/utils/mongodb-availability-error.js";

describe("MongoDB availability classification for AI-V01 dependencies", () => {
  it.each([
    new mongoose.mongo.MongoNetworkError("connection lost"),
    new mongoose.mongo.MongoNetworkTimeoutError("socket timed out"),
    new mongoose.mongo.MongoServerSelectionError("no reachable server", {}),
    new mongoose.Error.MongooseServerSelectionError("no reachable server"),
    new mongoose.mongo.MongoOperationTimeoutError("operation timed out"),
    new mongoose.mongo.MongoServerError({ code: 91, message: "shutdown" }),
    new mongoose.mongo.MongoServerError({ code: 10107, message: "primary changed" }),
    new mongoose.mongo.MongoServerError({ code: 134, message: "majority unavailable" }),
    new mongoose.mongo.MongoServerError({ code: 50, message: "read timed out" }),
  ])("recognizes a typed operational read failure (%#)", (error) => {
    expect(isMongoDbAvailabilityError(error)).toBe(true);
  });

  it.each([
    null,
    undefined,
    new Error("MongoDB unavailable"),
    new TypeError("MongoDB unavailable"),
    Object.assign(new TypeError("unexpected"), { code: 91 }),
    { name: "MongoNetworkError", code: 91 },
    Object.assign(new Error("connection lost"), { name: "MongoNetworkError" }),
    new AppError(403, "access denied"),
    Object.assign(new AppError(500, "projection failed"), { code: 91 }),
    new mongoose.Error("unclassified Mongoose failure"),
    new mongoose.Error.CastError("ObjectId", "bad-id", "_id"),
    new mongoose.Error.ValidationError(),
    new mongoose.mongo.MongoServerError({ code: 18, message: "authentication failed" }),
    new mongoose.mongo.MongoServerError({ code: 13, message: "unauthorized" }),
    new mongoose.mongo.MongoServerError({ code: 2, message: "invalid query" }),
    new mongoose.mongo.MongoServerError({ code: 121, message: "document invalid" }),
    new mongoose.mongo.MongoServerError({ code: 11000, message: "duplicate key" }),
    new mongoose.mongo.MongoServerError({ code: "91", message: "untrusted code type" }),
  ])("does not disguise refusal, data, or programming errors (%#)", (error) => {
    expect(isMongoDbAvailabilityError(error)).toBe(false);
  });
});
