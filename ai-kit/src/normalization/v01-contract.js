import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";

const V01_CONTRACT = JSON.parse(
  readFileSync(new URL("../../v01-contract.json", import.meta.url), "utf8"),
);

const ajv = new Ajv2020({ allErrors: true, strict: true });

const PROVIDER_SCHEMA_KEYWORDS = Object.freeze({
  gemini: new Set([
    "$defs",
    "$ref",
    "additionalProperties",
    "anyOf",
    "enum",
    "items",
    "maxItems",
    "maximum",
    "minItems",
    "minimum",
    "properties",
    "required",
    "type",
  ]),
  groq: new Set([
    "$defs",
    "$ref",
    "additionalProperties",
    "anyOf",
    "enum",
    "items",
    "maxItems",
    "maximum",
    "minItems",
    "minimum",
    "properties",
    "required",
    "type",
  ]),
});

const assertDefinitionName = (definitionName) => {
  if (!Object.hasOwn(V01_CONTRACT.$defs, definitionName)) {
    throw new TypeError(`Unknown AI-V01 contract definition: ${definitionName}`);
  }
};

const collectReachableDefinitions = (definitionName, reachable = new Set()) => {
  if (reachable.has(definitionName)) {
    return reachable;
  }

  reachable.add(definitionName);

  const references = JSON.stringify(V01_CONTRACT.$defs[definitionName])
    .matchAll(/"\$ref":"#\/\$defs\/([^"]+)"/g);

  for (const [, referencedName] of references) {
    collectReachableDefinitions(referencedName, reachable);
  }

  return reachable;
};

/**
 * Returns a self-contained Draft 2020-12 schema for one contract definition,
 * carrying only the `$defs` it references.
 */
const buildV01DefinitionSchema = (definitionName) => {
  assertDefinitionName(definitionName);

  const $defs = Object.fromEntries(
    [...collectReachableDefinitions(definitionName)]
      .map((name) => [name, structuredClone(V01_CONTRACT.$defs[name])]),
  );

  return {
    $schema: V01_CONTRACT.$schema,
    $defs,
    $ref: `#/$defs/${definitionName}`,
  };
};

const projectSchemaNode = (schema, allowedKeywords) => {
  if (Array.isArray(schema)) {
    return schema.map((value) => projectSchemaNode(value, allowedKeywords));
  }

  if (schema === null || typeof schema !== "object") {
    return schema;
  }

  const projected = {};

  for (const [keyword, value] of Object.entries(schema)) {
    if (!allowedKeywords.has(keyword)) {
      continue;
    }

    if (keyword === "properties" || keyword === "$defs") {
      projected[keyword] = Object.fromEntries(
        Object.entries(value).map(([name, childSchema]) => [
          name,
          projectSchemaNode(childSchema, allowedKeywords),
        ]),
      );
    } else {
      projected[keyword] = projectSchemaNode(value, allowedKeywords);
    }
  }

  return projected;
};

const assertGroqStrictObjects = (schema, path = "#") => {
  if (Array.isArray(schema)) {
    schema.forEach((value, index) => {
      assertGroqStrictObjects(value, `${path}/${index}`);
    });
    return;
  }

  if (schema === null || typeof schema !== "object") {
    return;
  }

  if (schema.type === "object") {
    const propertyNames = Object.keys(schema.properties ?? {}).sort();
    const requiredNames = [...(schema.required ?? [])].sort();

    if (schema.additionalProperties !== false
      || JSON.stringify(propertyNames) !== JSON.stringify(requiredNames)) {
      throw new TypeError(
        `AI-V01 provider schema is not Groq-strict at ${path}`,
      );
    }
  }

  for (const [keyword, value] of Object.entries(schema)) {
    assertGroqStrictObjects(value, `${path}/${keyword}`);
  }
};

/**
 * Projects one canonical definition onto a provider's documented JSON Schema
 * subset. The canonical schema remains the post-response validation authority.
 */
const buildV01ProviderSchema = (definitionName, provider) => {
  assertDefinitionName(definitionName);

  const allowedKeywords = PROVIDER_SCHEMA_KEYWORDS[provider];

  if (!allowedKeywords) {
    throw new TypeError(`Unknown AI-V01 structured-output provider: ${provider}`);
  }

  const reachable = [...collectReachableDefinitions(definitionName)];
  const canonicalRoot = structuredClone(V01_CONTRACT.$defs[definitionName]);
  const dependencyDefinitions = Object.fromEntries(
    reachable
      .filter((name) => name !== definitionName)
      .map((name) => [name, structuredClone(V01_CONTRACT.$defs[name])]),
  );
  const projected = projectSchemaNode(
    { ...canonicalRoot, $defs: dependencyDefinitions },
    allowedKeywords,
  );

  if (provider === "groq") {
    assertGroqStrictObjects(projected);
  }

  return projected;
};

/**
 * Compiles one canonical contract definition. The returned function reports
 * Ajv `instancePath` + message pairs and never echoes the validated data.
 */
const createV01Validator = (definitionName) => {
  const validate = ajv.compile(buildV01DefinitionSchema(definitionName));

  return (value) => {
    if (validate(value)) {
      return [];
    }

    return validate.errors.map(({ instancePath, message }) => {
      return `${instancePath || "/"} ${message}`;
    });
  };
};

export {
  buildV01DefinitionSchema,
  buildV01ProviderSchema,
  createV01Validator,
};
