import mongoose from "mongoose";

// Operational read failures from the installed driver's MongoDB error codes.
// Keep this list explicit: arbitrary MongoServerError (auth, invalid query,
// validation, etc.) and plain errors are not availability failures.
const AVAILABILITY_CODES = new Set([
  6, // HostUnreachable
  7, // HostNotFound
  50, // MaxTimeMSExpired
  89, // NetworkTimeout
  91, // ShutdownInProgress
  133, // FailedToSatisfyReadPreference
  134, // ReadConcernMajorityNotAvailableYet
  189, // PrimarySteppedDown
  262, // ExceededTimeLimit
  9001, // SocketException
  10107, // NotWritablePrimary
  11600, // InterruptedAtShutdown
  11602, // InterruptedDueToReplStateChange
  13435, // NotPrimaryNoSecondaryOk
  13436, // NotPrimaryOrSecondary
]);

const isMongoDbAvailabilityError = (error) => {
  return (
    error instanceof mongoose.mongo.MongoNetworkError ||
    error instanceof mongoose.mongo.MongoServerSelectionError ||
    error instanceof mongoose.Error.MongooseServerSelectionError ||
    error instanceof mongoose.mongo.MongoOperationTimeoutError ||
    (error instanceof mongoose.mongo.MongoServerError &&
      AVAILABILITY_CODES.has(error.code))
  );
};

export { isMongoDbAvailabilityError };
