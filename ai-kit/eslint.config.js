import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**"],
  },

  js.configs.recommended,

  {
    files: ["**/*.{js,mjs}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      globals: {
        ...globals.node,
      },
    },

    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["src/**/*.{js,mjs}"],

    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "AI Kit receives runtime configuration through createAiKit().",
        },
      ],
    },
  },

  {
    files: ["**/*.cjs"],

    languageOptions: {
      sourceType: "commonjs",

      globals: {
        ...globals.node,
      },
    },
  },
];
