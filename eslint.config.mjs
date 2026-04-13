import js from "@eslint/js";
import globals from "globals";

const nodeCommonJsGlobals = {
  ...globals.node,
};

const testGlobals = {
  ...nodeCommonJsGlobals,
  afterAll: "readonly",
  afterEach: "readonly",
  beforeAll: "readonly",
  beforeEach: "readonly",
  describe: "readonly",
  expect: "readonly",
  it: "readonly",
  test: "readonly",
  vi: "readonly",
};

export default [
  {
    ignores: [
      ".agent-workflow/**",
      ".claude/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "tmp/**",
    ],
  },
  {
    ...js.configs.recommended,
    files: ["*.js", "scripts/**/*.js", "src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: nodeCommonJsGlobals,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
  {
    ...js.configs.recommended,
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: testGlobals,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
  {
    ...js.configs.recommended,
    files: ["dashboard/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
  {
    ...js.configs.recommended,
    files: ["*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-useless-escape": "off",
    },
  },
];
