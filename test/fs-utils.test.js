const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  appendText,
  ensureDir,
  fileExists,
  listDirectories,
  readJson,
  readText,
  writeFile,
  writeFileIfMissing,
  writeJson,
} = require("../src/lib/fs-utils");

const REPO_ROOT = path.resolve(__dirname, "..");
const TEST_TMP_ROOT = path.join(REPO_ROOT, "tmp", "unit-tests");

const tests = [
  {
    name: "fs-utils bridge loads the compiled TypeScript module",
    run() {
      fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
      const workspaceRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, "fs-utils-"));
      const nestedFilePath = path.join(workspaceRoot, "nested", "sample.txt");
      const jsonFilePath = path.join(workspaceRoot, "nested", "sample.json");

      ensureDir(path.join(workspaceRoot, "beta"));
      ensureDir(path.join(workspaceRoot, "alpha"));
      writeFile(nestedFilePath, "hello");
      appendText(nestedFilePath, " world");
      writeFileIfMissing(nestedFilePath, "ignored");
      writeJson(jsonFilePath, { ok: true });

      assert.equal(fileExists(nestedFilePath), true);
      assert.equal(readText(nestedFilePath), "hello world");
      assert.deepEqual(readJson(jsonFilePath), { ok: true });
      assert.equal(readJson(path.join(workspaceRoot, "missing.json"), { ok: false }).ok, false);
      assert.deepEqual(listDirectories(workspaceRoot), ["alpha", "beta", "nested"]);
    },
  },
];

const suite = {
  name: "fs-utils",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
