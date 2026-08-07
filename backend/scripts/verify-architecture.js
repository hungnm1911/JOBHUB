import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(scriptDirectory, "..");
const sourceRoot = path.join(backendRoot, "src");

const canonicalFiles = Object.freeze({
  app: path.join(sourceRoot, "app.js"),
  authTokenType: path.join(
    sourceRoot,
    "constants",
    "auth-token-type.js",
  ),
  cloudinary: path.join(sourceRoot, "config", "cloudinary.js"),
  config: path.join(sourceRoot, "config", "index.js"),
  errorHandler: path.join(
    sourceRoot,
    "middlewares",
    "error-handler.js",
  ),
  mailer: path.join(sourceRoot, "config", "mailer.js"),
  mailService: path.join(sourceRoot, "services", "mail.service.js"),
  mongodb: path.join(sourceRoot, "config", "mongodb.js"),
  notFound: path.join(sourceRoot, "middlewares", "not-found.js"),
  rootEntry: path.join(backendRoot, "index.js"),
  rootRouter: path.join(sourceRoot, "routes", "index.js"),
});

const violations = [];

const toDisplayPath = (filePath) => {
  return path.relative(backendRoot, filePath).split(path.sep).join("/");
};

const getLineNumber = (source, index) => {
  return source.slice(0, index).split("\n").length;
};

const addViolation = ({ rule, filePath, reason, line }) => {
  violations.push({
    rule,
    file: toDisplayPath(filePath),
    line,
    reason,
  });
};

const walkJavaScriptFiles = (directory) => {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkJavaScriptFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(entryPath);
    }
  }

  return files;
};

const maskSource = (source, { preserveStrings = false } = {}) => {
  const characters = [...source];
  let state = "code";
  const templateExpressionDepths = [];

  const mask = (index) => {
    if (characters[index] !== "\n" && characters[index] !== "\r") {
      characters[index] = " ";
    }
  };

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const nextCharacter = characters[index + 1];

    if (state === "code") {
      if (
        templateExpressionDepths.length > 0 &&
        character === "{"
      ) {
        templateExpressionDepths[templateExpressionDepths.length - 1] += 1;
      } else if (
        templateExpressionDepths.length > 0 &&
        character === "}"
      ) {
        const depthIndex = templateExpressionDepths.length - 1;

        templateExpressionDepths[depthIndex] -= 1;

        if (templateExpressionDepths[depthIndex] === 0) {
          templateExpressionDepths.pop();
          mask(index);
          state = "template-string";
        }
      } else if (character === "/" && nextCharacter === "/") {
        mask(index);
        mask(index + 1);
        index += 1;
        state = "line-comment";
      } else if (character === "/" && nextCharacter === "*") {
        mask(index);
        mask(index + 1);
        index += 1;
        state = "block-comment";
      } else if (!preserveStrings && character === "'") {
        mask(index);
        state = "single-quoted-string";
      } else if (!preserveStrings && character === "\"") {
        mask(index);
        state = "double-quoted-string";
      } else if (!preserveStrings && character === "`") {
        mask(index);
        state = "template-string";
      }

      continue;
    }

    if (state === "line-comment") {
      mask(index);

      if (character === "\n") {
        state = "code";
      }

      continue;
    }

    if (state === "block-comment") {
      mask(index);

      if (character === "*" && nextCharacter === "/") {
        mask(index + 1);
        index += 1;
        state = "code";
      }

      continue;
    }

    if (state === "template-string") {
      mask(index);

      if (character === "\\") {
        mask(index + 1);
        index += 1;
      } else if (character === "`") {
        state = "code";
      } else if (character === "$" && nextCharacter === "{") {
        mask(index + 1);
        index += 1;
        templateExpressionDepths.push(1);
        state = "code";
      }

      continue;
    }

    mask(index);

    if (character === "\\") {
      mask(index + 1);
      index += 1;
    } else if (
      (state === "single-quoted-string" && character === "'") ||
      (state === "double-quoted-string" && character === "\"")
    ) {
      state = "code";
    }
  }

  return characters.join("");
};

const extractImports = (source) => {
  const sourceWithoutComments = maskSource(source, {
    preserveStrings: true,
  });
  const imports = [];
  const fromImportPattern =
    /^\s*import\s+([^;"']*?)\s+from\s+(["'])([^"']+)\2\s*;?/gm;
  const sideEffectImportPattern =
    /^\s*import\s+(["'])([^"']+)\1\s*;?/gm;
  const dynamicImportPattern =
    /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g;

  for (const match of sourceWithoutComments.matchAll(fromImportPattern)) {
    const clause = match[1].trim();
    const defaultBindingMatch = clause.match(/^([A-Za-z_$][\w$]*)/);

    imports.push({
      specifier: match[3],
      index: match.index,
      defaultBinding: defaultBindingMatch?.[1] ?? null,
    });
  }

  for (const match of sourceWithoutComments.matchAll(sideEffectImportPattern)) {
    imports.push({
      specifier: match[2],
      index: match.index,
      defaultBinding: null,
    });
  }

  for (const match of sourceWithoutComments.matchAll(dynamicImportPattern)) {
    imports.push({
      specifier: match[2],
      index: match.index,
      defaultBinding: null,
    });
  }

  return imports;
};

const resolveLocalImport = (importerPath, specifier) => {
  if (!specifier.startsWith(".")) {
    return null;
  }

  return path.resolve(path.dirname(importerPath), specifier);
};

const isWithin = (candidatePath, parentPath) => {
  const relativePath = path.relative(parentPath, candidatePath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== "..")
  );
};

const isPackageImport = (specifier, packageName) => {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
};

const findCodeMatches = (source, pattern) => {
  const codeOnlySource = maskSource(source);

  return [...codeOnlySource.matchAll(pattern)];
};

const sourceFiles = walkJavaScriptFiles(sourceRoot).sort();
const applicationFiles = [canonicalFiles.rootEntry, ...sourceFiles];
const sourceByFile = new Map(
  applicationFiles.map((filePath) => [
    filePath,
    fs.readFileSync(filePath, "utf8"),
  ]),
);
const importsByFile = new Map(
  applicationFiles.map((filePath) => [
    filePath,
    extractImports(sourceByFile.get(filePath)),
  ]),
);

const checkSourceFilenames = () => {
  const approvedFilenamePattern =
    /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*\.js$/;

  for (const filePath of sourceFiles) {
    const filename = path.basename(filePath);

    if (!approvedFilenamePattern.test(filename)) {
      addViolation({
        rule: "ARCH-001",
        filePath,
        reason: "JavaScript source filename must use lowercase kebab-case.",
      });
    }
  }
};

const checkLayerSuffixes = () => {
  const layerRules = [
    ["routes", ".routes.js"],
    ["controllers", ".controller.js"],
    ["services", ".service.js"],
    ["models", ".model.js"],
  ];

  for (const [directoryName, suffix] of layerRules) {
    const layerDirectory = path.join(sourceRoot, directoryName);

    for (const filePath of sourceFiles) {
      if (!isWithin(filePath, layerDirectory)) {
        continue;
      }

      const filename = path.basename(filePath);

      if (filename !== "index.js" && !filename.endsWith(suffix)) {
        addViolation({
          rule: "ARCH-002",
          filePath,
          reason: `Files under src/${directoryName}/ must use ${suffix} or be index.js.`,
        });
      }
    }
  }
};

const checkProcessEnvironmentOwnership = () => {
  for (const [filePath, source] of sourceByFile) {
    for (const match of findCodeMatches(source, /\bprocess\s*\.\s*env\b/g)) {
      if (filePath !== canonicalFiles.config) {
        addViolation({
          rule: "ARCH-003",
          filePath,
          line: getLineNumber(source, match.index),
          reason: "Direct process.env access belongs only to src/config/index.js.",
        });
      }
    }
  }
};

const checkDotenvOwnership = () => {
  const loaderOwners = new Set();

  for (const [filePath, source] of sourceByFile) {
    for (const importedModule of importsByFile.get(filePath)) {
      if (!isPackageImport(importedModule.specifier, "dotenv")) {
        continue;
      }

      loaderOwners.add(filePath);

      if (filePath !== canonicalFiles.config) {
        addViolation({
          rule: "ARCH-004",
          filePath,
          line: getLineNumber(source, importedModule.index),
          reason: "Dotenv may be imported only by src/config/index.js.",
        });
      }
    }

    for (const match of findCodeMatches(
      source,
      /\bdotenv\s*\.\s*config\s*\(/g,
    )) {
      loaderOwners.add(filePath);

      if (filePath !== canonicalFiles.config) {
        addViolation({
          rule: "ARCH-004",
          filePath,
          line: getLineNumber(source, match.index),
          reason: "Dotenv loading belongs only to src/config/index.js.",
        });
      }
    }
  }

  if (!loaderOwners.has(canonicalFiles.config)) {
    addViolation({
      rule: "ARCH-004",
      filePath: canonicalFiles.config,
      reason: "The canonical configuration module must load dotenv.",
    });
  }

  if (loaderOwners.size > 1) {
    addViolation({
      rule: "ARCH-004",
      filePath: canonicalFiles.config,
      reason: "More than one dotenv-loading owner was detected.",
    });
  }
};

const checkExpressApplicationOwnership = () => {
  for (const [filePath, source] of sourceByFile) {
    for (const match of findCodeMatches(source, /\bexpress\s*\(/g)) {
      if (filePath !== canonicalFiles.app) {
        addViolation({
          rule: "ARCH-005",
          filePath,
          line: getLineNumber(source, match.index),
          reason: "Production Express application creation belongs to src/app.js.",
        });
      }
    }
  }
};

const checkHttpListenerOwnership = () => {
  for (const [filePath, source] of sourceByFile) {
    const listenerPattern =
      /\b([A-Za-z_$][\w$]*)\s*\.\s*listen\s*\(/g;

    for (const match of findCodeMatches(source, listenerPattern)) {
      const receiver = match[1];
      const resemblesHttpOwner =
        /^(?:app|server|httpServer|httpsServer|apiServer)$/i.test(receiver) ||
        /Server$/.test(receiver);

      if (resemblesHttpOwner && filePath !== canonicalFiles.rootEntry) {
        addViolation({
          rule: "ARCH-006",
          filePath,
          line: getLineNumber(source, match.index),
          reason: "HTTP listener startup belongs only to root backend/index.js.",
        });
      }
    }
  }
};

const checkPersistenceImportBoundary = ({
  directoryName,
  rule,
  layerLabel,
}) => {
  const directory = path.join(sourceRoot, directoryName);
  const modelsDirectory = path.join(sourceRoot, "models");
  const databaseDirectory = path.join(sourceRoot, "database");

  for (const filePath of sourceFiles) {
    if (!isWithin(filePath, directory)) {
      continue;
    }

    const source = sourceByFile.get(filePath);

    for (const importedModule of importsByFile.get(filePath)) {
      const resolvedImport = resolveLocalImport(
        filePath,
        importedModule.specifier,
      );
      const importsPersistence =
        isPackageImport(importedModule.specifier, "mongoose") ||
        (resolvedImport !== null &&
          (isWithin(resolvedImport, modelsDirectory) ||
            isWithin(resolvedImport, databaseDirectory)));

      if (importsPersistence) {
        addViolation({
          rule,
          filePath,
          line: getLineNumber(source, importedModule.index),
          reason: `${layerLabel} must not import models, database modules, or mongoose directly.`,
        });
      }
    }
  }
};

const checkServiceHttpBoundary = () => {
  const serviceDirectory = path.join(sourceRoot, "services");
  const forbiddenDirectories = [
    path.join(sourceRoot, "routes"),
    path.join(sourceRoot, "controllers"),
    path.join(sourceRoot, "middlewares"),
  ];

  for (const filePath of sourceFiles) {
    if (!isWithin(filePath, serviceDirectory)) {
      continue;
    }

    const source = sourceByFile.get(filePath);

    for (const importedModule of importsByFile.get(filePath)) {
      const resolvedImport = resolveLocalImport(
        filePath,
        importedModule.specifier,
      );
      const importsHttpLayer =
        isPackageImport(importedModule.specifier, "express") ||
        (resolvedImport !== null &&
          forbiddenDirectories.some((directory) =>
            isWithin(resolvedImport, directory),
          ));

      if (importsHttpLayer) {
        addViolation({
          rule: "ARCH-009",
          filePath,
          line: getLineNumber(source, importedModule.index),
          reason: "Services must not import Express or HTTP-layer modules.",
        });
      }
    }
  }
};

const checkConfigurationDependencyDirection = () => {
  const configDirectory = path.join(sourceRoot, "config");
  const forbiddenDirectories = [
    path.join(sourceRoot, "routes"),
    path.join(sourceRoot, "controllers"),
    path.join(sourceRoot, "services"),
    path.join(sourceRoot, "models"),
    path.join(sourceRoot, "database"),
  ];

  for (const filePath of sourceFiles) {
    if (!isWithin(filePath, configDirectory)) {
      continue;
    }

    const source = sourceByFile.get(filePath);

    for (const importedModule of importsByFile.get(filePath)) {
      const resolvedImport = resolveLocalImport(
        filePath,
        importedModule.specifier,
      );

      if (
        resolvedImport !== null &&
        forbiddenDirectories.some((directory) =>
          isWithin(resolvedImport, directory),
        )
      ) {
        addViolation({
          rule: "ARCH-010",
          filePath,
          line: getLineNumber(source, importedModule.index),
          reason: "Configuration must not import upper application layers.",
        });
      }
    }
  }
};

const checkCallOwnership = ({ rule, pattern, owner, reason }) => {
  for (const [filePath, source] of sourceByFile) {
    for (const match of findCodeMatches(source, pattern)) {
      if (filePath !== owner) {
        addViolation({
          rule,
          filePath,
          line: getLineNumber(source, match.index),
          reason,
        });
      }
    }
  }
};

const findMatchingParenthesis = (source, openingIndex) => {
  let depth = 0;

  for (let index = openingIndex; index < source.length; index += 1) {
    if (source[index] === "(") {
      depth += 1;
    } else if (source[index] === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
};

const findDefaultImportBinding = ({ imports, importerPath, targetPath }) => {
  return imports.find((importedModule) => {
    return (
      importedModule.defaultBinding !== null &&
      resolveLocalImport(importerPath, importedModule.specifier) === targetPath
    );
  })?.defaultBinding;
};

const checkApplicationMiddlewareComposition = () => {
  const source = sourceByFile.get(canonicalFiles.app);
  const imports = importsByFile.get(canonicalFiles.app);
  const codeOnlySource = maskSource(source);
  const rootRouterBinding = findDefaultImportBinding({
    imports,
    importerPath: canonicalFiles.app,
    targetPath: canonicalFiles.rootRouter,
  });
  const notFoundBinding = findDefaultImportBinding({
    imports,
    importerPath: canonicalFiles.app,
    targetPath: canonicalFiles.notFound,
  });
  const errorHandlerBinding = findDefaultImportBinding({
    imports,
    importerPath: canonicalFiles.app,
    targetPath: canonicalFiles.errorHandler,
  });

  if (!rootRouterBinding || !notFoundBinding || !errorHandlerBinding) {
    addViolation({
      rule: "ARCH-015",
      filePath: canonicalFiles.app,
      reason: "App composition must import the root router, not-found middleware, and error handler.",
    });

    return;
  }

  const registrations = [];

  for (const match of codeOnlySource.matchAll(/\bapp\s*\.\s*use\s*\(/g)) {
    const openingIndex = codeOnlySource.indexOf("(", match.index);
    const closingIndex = findMatchingParenthesis(codeOnlySource, openingIndex);

    if (closingIndex === -1) {
      addViolation({
        rule: "ARCH-015",
        filePath: canonicalFiles.app,
        line: getLineNumber(source, match.index),
        reason: "Unable to deterministically inspect an app.use registration.",
      });

      continue;
    }

    registrations.push({
      body: codeOnlySource.slice(openingIndex + 1, closingIndex),
      index: match.index,
    });
  }

  const findRegistrationIndex = (binding) => {
    const bindingPattern = new RegExp(`\\b${binding}\\b`);

    return registrations.findIndex((registration) =>
      bindingPattern.test(registration.body),
    );
  };

  const rootRouterIndex = findRegistrationIndex(rootRouterBinding);
  const notFoundIndex = findRegistrationIndex(notFoundBinding);
  const errorHandlerIndex = findRegistrationIndex(errorHandlerBinding);

  if (
    rootRouterIndex === -1 ||
    notFoundIndex === -1 ||
    errorHandlerIndex === -1 ||
    !(rootRouterIndex < notFoundIndex && notFoundIndex < errorHandlerIndex)
  ) {
    addViolation({
      rule: "ARCH-015",
      filePath: canonicalFiles.app,
      reason: "Application middleware order must be root router, not-found, then error handler.",
    });
  }

  if (
    errorHandlerIndex === -1 ||
    errorHandlerIndex !== registrations.length - 1
  ) {
    addViolation({
      rule: "ARCH-015",
      filePath: canonicalFiles.app,
      reason: "The centralized error handler must be the final app.use registration.",
    });
  }
};

const extractAuthTokenTypeEntries = (source) => {
  const sourceWithoutComments = maskSource(source, {
    preserveStrings: true,
  });
  const codeOnlySource = maskSource(source);
  const declarationIndex = sourceWithoutComments.indexOf("AUTH_TOKEN_TYPE");

  if (declarationIndex === -1) {
    return [];
  }

  const openingIndex = codeOnlySource.indexOf("{", declarationIndex);

  if (openingIndex === -1) {
    return [];
  }

  let depth = 0;
  let closingIndex = -1;

  for (let index = openingIndex; index < codeOnlySource.length; index += 1) {
    if (codeOnlySource[index] === "{") {
      depth += 1;
    } else if (codeOnlySource[index] === "}") {
      depth -= 1;

      if (depth === 0) {
        closingIndex = index;
        break;
      }
    }
  }

  if (closingIndex === -1) {
    return [];
  }

  const objectBody = sourceWithoutComments.slice(
    openingIndex + 1,
    closingIndex,
  );
  const entries = [];
  const propertyPattern =
    /\b([A-Z][A-Z0-9_]*)\s*:\s*(["'])([^"']+)\2/g;

  for (const match of objectBody.matchAll(propertyPattern)) {
    entries.push([match[1], match[3]]);
  }

  return entries;
};

const checkAuthenticationTokenOwnership = () => {
  const competingOwner = path.join(
    sourceRoot,
    "constants",
    "token-type.js",
  );

  if (fs.existsSync(competingOwner)) {
    addViolation({
      rule: "ARCH-016",
      filePath: competingOwner,
      reason: "src/constants/token-type.js must not compete with the V1 canonical owner.",
    });
  }

  if (!fs.existsSync(canonicalFiles.authTokenType)) {
    addViolation({
      rule: "ARCH-016",
      filePath: canonicalFiles.authTokenType,
      reason: "The canonical V1 authentication-token type owner is missing.",
    });
  } else {
    const source = sourceByFile.get(canonicalFiles.authTokenType);
    const actualEntries = extractAuthTokenTypeEntries(source).sort();
    const expectedEntries = [
      ["EMAIL_VERIFICATION", "EMAIL_VERIFICATION"],
      ["PASSWORD_RESET", "PASSWORD_RESET"],
    ].sort();

    if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
      addViolation({
        rule: "ARCH-016",
        filePath: canonicalFiles.authTokenType,
        reason: "V1 authentication-token types must be exactly EMAIL_VERIFICATION and PASSWORD_RESET.",
      });
    }
  }

  for (const [filePath, source] of sourceByFile) {
    const forbiddenReferencePattern =
      /\b(?:AUTH_TOKEN_TYPE|TOKEN_TYPE)\s*\.\s*INVITE\b/g;

    for (const match of findCodeMatches(source, forbiddenReferencePattern)) {
      addViolation({
        rule: "ARCH-016",
        filePath,
        line: getLineNumber(source, match.index),
        reason: "INVITE is not an approved V1 authentication-token type.",
      });
    }
  }
};

checkSourceFilenames();
checkLayerSuffixes();
checkProcessEnvironmentOwnership();
checkDotenvOwnership();
checkExpressApplicationOwnership();
checkHttpListenerOwnership();
checkPersistenceImportBoundary({
  directoryName: "routes",
  rule: "ARCH-007",
  layerLabel: "Routes",
});
checkPersistenceImportBoundary({
  directoryName: "controllers",
  rule: "ARCH-008",
  layerLabel: "Controllers",
});
checkServiceHttpBoundary();
checkConfigurationDependencyDirection();
checkCallOwnership({
  rule: "ARCH-011",
  pattern: /\bmongoose\s*\.\s*connect\s*\(/g,
  owner: canonicalFiles.mongodb,
  reason: "MongoDB connection creation belongs only to src/config/mongodb.js.",
});
checkCallOwnership({
  rule: "ARCH-012",
  pattern: /\bcloudinary\s*\.\s*config\s*\(/g,
  owner: canonicalFiles.cloudinary,
  reason: "Cloudinary configuration belongs only to src/config/cloudinary.js.",
});
checkCallOwnership({
  rule: "ARCH-013",
  pattern: /\bnodemailer\s*\.\s*createTransport\s*\(/g,
  owner: canonicalFiles.mailer,
  reason: "SMTP transport creation belongs only to src/config/mailer.js.",
});
checkCallOwnership({
  rule: "ARCH-014",
  pattern: /\btransporter\s*\.\s*sendMail\s*\(/g,
  owner: canonicalFiles.mailService,
  reason: "Direct SMTP sending belongs only to src/services/mail.service.js.",
});
checkApplicationMiddlewareComposition();
checkAuthenticationTokenOwnership();

if (violations.length > 0) {
  console.error(
    `Architecture verification failed with ${violations.length} violation(s):`,
  );

  for (const violation of violations) {
    const location = violation.line
      ? `${violation.file}:${violation.line}`
      : violation.file;

    console.error(
      `- [${violation.rule}] ${location}: ${violation.reason}`,
    );
  }

  process.exitCode = 1;
} else {
  console.log("Architecture verification passed (ARCH-001 through ARCH-016).");
}
