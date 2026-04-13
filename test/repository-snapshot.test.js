const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { buildScopeProofAnchors, loadRepositorySnapshot } = require("../src/lib/repository-snapshot");
const {
  createTaskWorkspace,
  initializeGitRepository,
  readJsonFile,
  runCommand,
  writeJsonFile,
  writeTextFile,
} = require("./test-helpers");

function commitAll(workspaceRoot, message) {
  runCommand("git", ["add", "."], workspaceRoot);
  runCommand("git", ["commit", "-m", message], workspaceRoot);
}

const tests = [
  {
    name: "git snapshot reports modified and untracked files without walking the whole workspace contract",
    run() {
      const { workspaceRoot } = createTaskWorkspace("repository-snapshot-git");
      initializeGitRepository(workspaceRoot);
      writeTextFile(`${workspaceRoot}/README.md`, "# Snapshot test\n");
      commitAll(workspaceRoot, "initial");

      writeTextFile(`${workspaceRoot}/README.md`, "# Snapshot test\n\nupdated\n");
      writeTextFile(`${workspaceRoot}/notes.txt`, "untracked\n");

      const snapshot = loadRepositorySnapshot(workspaceRoot);
      const modifiedEntry = snapshot.files.find((item) => item.path === "README.md");
      const untrackedEntry = snapshot.files.find((item) => item.path === "notes.txt");

      assert.equal(snapshot.mode, "git");
      assert.ok(typeof snapshot.collectedAt === "string" && snapshot.collectedAt.length > 0);
      assert.ok(snapshot.headCommit);
      assert.equal(snapshot.fileCount, 2);
      assert.ok(modifiedEntry);
      assert.equal(modifiedEntry.changeType, "modified");
      assert.equal(modifiedEntry.gitState, "M");
      assert.equal(typeof modifiedEntry.contentFingerprint, "string");
      assert.ok(untrackedEntry);
      assert.equal(untrackedEntry.changeType, "untracked");
      assert.equal(untrackedEntry.gitState, "??");
    },
  },
  {
    name: "git snapshot preserves rename metadata for current scope matching and audit trails",
    run() {
      const { workspaceRoot } = createTaskWorkspace("repository-snapshot-rename");
      initializeGitRepository(workspaceRoot);
      writeTextFile(`${workspaceRoot}/old name.txt`, "before\n");
      commitAll(workspaceRoot, "initial");

      runCommand("git", ["mv", "old name.txt", "new name.txt"], workspaceRoot);

      const snapshot = loadRepositorySnapshot(workspaceRoot);
      const renamedEntry = snapshot.files.find((item) => item.changeType === "renamed");

      assert.equal(snapshot.mode, "git");
      assert.ok(renamedEntry);
      assert.equal(renamedEntry.path, "new name.txt");
      assert.equal(renamedEntry.previousPath, "old name.txt");
      assert.equal(renamedEntry.gitState, "R");
    },
  },
  {
    name: "snapshot falls back to filesystem mode when git is unavailable",
    run() {
      const { workspaceRoot } = createTaskWorkspace("repository-snapshot-fallback");
      writeTextFile(`${workspaceRoot}/plain.txt`, "fallback\n");

      const snapshot = loadRepositorySnapshot(workspaceRoot, {
        gitCommand: "definitely-not-a-real-git-command",
      });

      assert.equal(snapshot.mode, "filesystem");
      assert.equal(snapshot.available, true);
      assert.ok(snapshot.fileCount >= 1);
      assert.ok(snapshot.files.some((item) => item.path === "plain.txt"));
    },
  },
  {
    name: "scope proof anchors hash targeted files even in filesystem fallback mode",
    run() {
      const { workspaceRoot } = createTaskWorkspace("repository-snapshot-proof-anchors");
      writeTextFile(`${workspaceRoot}/plain.txt`, "fallback\n");

      const snapshot = loadRepositorySnapshot(workspaceRoot, {
        gitCommand: "definitely-not-a-real-git-command",
      });
      const anchors = buildScopeProofAnchors(workspaceRoot, ["plain.txt"], snapshot);

      assert.equal(snapshot.mode, "filesystem");
      assert.equal(anchors.length, 1);
      assert.equal(anchors[0].path, "plain.txt");
      assert.equal(anchors[0].exists, true);
      assert.match(String(anchors[0].contentFingerprint || ""), /^sha1:/);
    },
  },
  {
    name: "targeted proof fingerprint hashing reuses cached fingerprints until file mtime changes",
    run() {
      const { workspaceRoot } = createTaskWorkspace("repository-snapshot-cache");
      const proofPath = `${workspaceRoot}/plain.txt`;
      writeTextFile(proofPath, "initial\n");

      const snapshot = loadRepositorySnapshot(workspaceRoot, {
        gitCommand: "definitely-not-a-real-git-command",
      });
      const firstAnchors = buildScopeProofAnchors(workspaceRoot, ["plain.txt"], snapshot);
      const originalReadFileSync = fs.readFileSync;

      try {
        fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
          if (path.resolve(filePath) === path.resolve(proofPath)) {
            throw new Error("Fingerprint cache miss for unchanged proof path.");
          }
          return originalReadFileSync.call(fs, filePath, ...args);
        };

        const cachedAnchors = buildScopeProofAnchors(workspaceRoot, ["plain.txt"], snapshot);
        assert.equal(cachedAnchors[0].contentFingerprint, firstAnchors[0].contentFingerprint);
      } finally {
        fs.readFileSync = originalReadFileSync;
      }

      writeTextFile(proofPath, "updated\n");
      const refreshedAnchors = buildScopeProofAnchors(workspaceRoot, ["plain.txt"], snapshot);
      assert.notEqual(refreshedAnchors[0].contentFingerprint, firstAnchors[0].contentFingerprint);
    },
  },
  {
    name: "task.json proof fingerprints ignore updatedAt churn but still detect semantic task changes",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("repository-snapshot-task-meta");
      const relativeTaskMetaPath = `.agent-workflow/tasks/${taskId}/task.json`;
      const firstFingerprint = buildScopeProofAnchors(workspaceRoot, [relativeTaskMetaPath])[0].contentFingerprint;

      const taskMeta = readJsonFile(files.meta);
      taskMeta.updatedAt = "2026-04-09T02:10:00.000Z";
      writeJsonFile(files.meta, taskMeta);

      const updatedAtOnlyFingerprint = buildScopeProofAnchors(workspaceRoot, [relativeTaskMetaPath])[0].contentFingerprint;
      assert.equal(updatedAtOnlyFingerprint, firstFingerprint);

      taskMeta.goal = "A materially different task goal.";
      writeJsonFile(files.meta, taskMeta);

      const semanticChangeFingerprint = buildScopeProofAnchors(workspaceRoot, [relativeTaskMetaPath])[0].contentFingerprint;
      assert.notEqual(semanticChangeFingerprint, firstFingerprint);
    },
  },
  {
    name: "verification proof fingerprints ignore evidence churn but still detect proof-link edits",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("repository-snapshot-verification");
      const relativeVerificationPath = `.agent-workflow/tasks/${taskId}/verification.md`;

      writeTextFile(
        files.verification,
        [
          "# T-001 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/app.js",
          "- Check: npm test",
          "",
        ].join("\n")
      );

      const baseFingerprint = buildScopeProofAnchors(workspaceRoot, [relativeVerificationPath])[0].contentFingerprint;

      writeTextFile(
        files.verification,
        [
          "# T-001 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/app.js",
          "- Check: npm test",
          "",
          "## Evidence",
          "",
          "<!-- agent-workflow:managed:verification-manual-proof-anchors:start -->",
          "### Manual proof anchors",
          "",
          "```json",
          JSON.stringify({ version: 1, manualProofAnchors: [] }, null, 2),
          "```",
          "<!-- agent-workflow:managed:verification-manual-proof-anchors:end -->",
          "",
          "## Evidence 2026-04-09T02:00:00.000Z",
          "",
          "- Source: executor",
          "- Summary: Completed",
          "",
        ].join("\n")
      );

      const evidenceOnlyFingerprint = buildScopeProofAnchors(workspaceRoot, [relativeVerificationPath])[0].contentFingerprint;
      assert.equal(evidenceOnlyFingerprint, baseFingerprint);

      writeTextFile(
        files.verification,
        [
          "# T-001 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/app.js",
          "- Check: npm test --changed",
          "",
        ].join("\n")
      );

      const proofEditFingerprint = buildScopeProofAnchors(workspaceRoot, [relativeVerificationPath])[0].contentFingerprint;
      assert.notEqual(proofEditFingerprint, baseFingerprint);
    },
  },
];

const suite = {
  name: "repository-snapshot",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
