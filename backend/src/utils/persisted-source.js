import mongoose from "mongoose";

const isPlainObject = (value) => {
  if (value == null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

// Mongoose hydration casts persisted values (5 -> "5", "x" -> ["x"], an
// uncastable value -> the schema default), which would hide malformed data.
// Track own-property presence while descending: BSON Undefined decodes to an
// own property whose value is undefined, while only an absent key may use the
// hydrated schema default.
const overlayPersistedValue = (raw, hydrated) => {
  const overlay = (rawValue, hydratedValue, isPresent) => {
    if (!isPresent) {
      return hydratedValue;
    }

    if (isPlainObject(rawValue) && isPlainObject(hydratedValue)) {
      const keys = new Set([
        ...Object.keys(hydratedValue),
        ...Object.keys(rawValue),
      ]);

      return Object.fromEntries(
        [...keys].map((key) => [
          key,
          overlay(
            rawValue[key],
            hydratedValue[key],
            Object.hasOwn(rawValue, key),
          ),
        ]),
      );
    }

    if (
      Array.isArray(rawValue) &&
      Array.isArray(hydratedValue) &&
      rawValue.length === hydratedValue.length
    ) {
      return Array.from({ length: rawValue.length }, (_, index) =>
        overlay(
          rawValue[index],
          hydratedValue[index],
          Object.hasOwn(rawValue, index),
        ),
      );
    }

    return rawValue;
  };

  return overlay(raw, hydrated, true);
};

// The Backend serializes persisted ObjectIds and Dates itself, so it must
// refuse any other stored type instead of letting a string pass as an ID/date.
const toPersistedIdString = (value, path, issues) => {
  if (value === null) {
    return null;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value.toString();
  }

  issues.push(`${path} must be null or a persisted ObjectId`);

  return value;
};

const toPersistedIdStrings = (values, path, issues) => {
  if (!Array.isArray(values)) {
    return values;
  }

  return values.map((value, index) => {
    if (value === null) {
      issues.push(`${path}/${index} must be a persisted ObjectId`);

      return value;
    }

    return toPersistedIdString(value, `${path}/${index}`, issues);
  });
};

const toPersistedIsoDate = (value, path, issues) => {
  if (value === null) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  issues.push(`${path} must be null or a persisted Date`);

  return value;
};

export {
  overlayPersistedValue,
  toPersistedIdString,
  toPersistedIdStrings,
  toPersistedIsoDate,
};
