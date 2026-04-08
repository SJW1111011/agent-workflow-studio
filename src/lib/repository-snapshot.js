const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const FILE_FINGERPRINT_CACHE_LIMIT = 256;
const fileFingerprintCache = new Map();

function loadRepositorySnapshot(workspaceRoot, options = {}) {
  if (!workspaceRoot) {
    throw new Error("workspaceRoot is required to load a repository snapshot.");
  }

  if (!options.preferFilesystem) {
    const gitSnapshot = tryLoadGitRepositorySnapshot(workspaceRoot, options);
    if (gitSnapshot) {
      return gitSnapshot;
    }
  }

  return loadFilesystemSnapshot(workspaceRoot);
}

function loadGitRepositorySnapshot(workspaceRoot, options = {}) {
  if (!workspaceRoot) {
    throw new Error("workspaceRoot is required to load a repository snapshot.");
  }

  return tryLoadGitRepositorySnapshot(workspaceRoot, options);
}

function tryLoadGitRepositorySnapshot(workspaceRoot, options = {}) {
  const gitCommand = options.gitCommand || "git";
  const repositoryRoot = runGitCommand(gitCommand, ["rev-parse", "--show-toplevel"], workspaceRoot);
  if (!repositoryRoot) {
    return null;
  }

  const collectedAt = new Date().toISOString();
  const headCommit = runGitCommand(gitCommand, ["rev-parse", "HEAD"], workspaceRoot);
  const statusOutput = runGitCommand(
    gitCommand,
    ["status", "--porcelain=v2", "-z", "--untracked-files=all"],
    workspaceRoot
  );

  if (statusOutput === null) {
    return null;
  }

  const files = parseGitStatusPorcelainV2(statusOutput, workspaceRoot);
  return {
    mode: "git",
    available: true,
    collectedAt,
    headCommit: headCommit ? headCommit.trim() : null,
    repositoryRoot: repositoryRoot.trim(),
    fileCount: files.length,
    files,
  };
}

function loadFilesystemSnapshot(workspaceRoot) {
  const files = walkWorkspaceFiles(workspaceRoot);
  return {
    mode: "filesystem",
    available: true,
    collectedAt: new Date().toISOString(),
    headCommit: null,
    repositoryRoot: workspaceRoot,
    fileCount: files.length,
    files,
  };
}

function buildScopeProofAnchors(workspaceRoot, proofPaths, repositorySnapshot = null) {
  const snapshot = repositorySnapshot || loadRepositorySnapshot(workspaceRoot);
  const snapshotFilesByPath = new Map(
    (Array.isArray(snapshot.files) ? snapshot.files : [])
      .filter((entry) => normalizeSnapshotPath(entry.path))
      .map((entry) => [normalizeSnapshotPath(entry.path), entry])
  );

  return Array.from(
    new Map(
      (Array.isArray(proofPaths) ? proofPaths : [])
        .map((proofPath) => buildProofAnchor(workspaceRoot, proofPath, snapshotFilesByPath.get(normalizeSnapshotPath(proofPath))))
        .filter(Boolean)
        .map((anchor) => [anchor.path, anchor])
    ).values()
  );
}

function buildProofAnchor(workspaceRoot, proofPath, repositoryEntry = null) {
  const normalizedPath = normalizeSnapshotPath(proofPath || (repositoryEntry ? repositoryEntry.path : null));
  if (!normalizedPath) {
    return null;
  }

  const directFileAnchor = buildDirectProofAnchor(workspaceRoot, normalizedPath);
  if (!repositoryEntry && !directFileAnchor) {
    return null;
  }

  return {
    path: normalizedPath,
    gitState: repositoryEntry && repositoryEntry.gitState ? repositoryEntry.gitState : undefined,
    previousPath:
      repositoryEntry && normalizeSnapshotPath(repositoryEntry.previousPath)
        ? normalizeSnapshotPath(repositoryEntry.previousPath)
        : undefined,
    exists:
      repositoryEntry && repositoryEntry.exists !== undefined
        ? Boolean(repositoryEntry.exists)
        : directFileAnchor
          ? true
          : undefined,
    contentFingerprint:
      repositoryEntry && repositoryEntry.contentFingerprint
        ? repositoryEntry.contentFingerprint
        : directFileAnchor
          ? directFileAnchor.contentFingerprint
          : undefined,
  };
}

function runGitCommand(command, args, cwd) {
  const captureDir = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workflow-git-"));
  const outputPath = path.join(captureDir, "stdout.txt");
  const outputFd = fs.openSync(outputPath, "w");

  try {
    execFileSync(command, args, {
      cwd,
      stdio: ["ignore", outputFd, "ignore"],
    });
    return fs.readFileSync(outputPath, "utf8");
  } catch (error) {
    return null;
  } finally {
    try {
      fs.closeSync(outputFd);
    } catch (error) {
      // ignore cleanup errors
    }
    fs.rmSync(captureDir, { recursive: true, force: true });
  }
}

function parseGitStatusPorcelainV2(output, workspaceRoot) {
  const records = String(output || "")
    .split("\0")
    .filter(Boolean);
  const files = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.startsWith("#")) {
      continue;
    }

    if (record.startsWith("? ")) {
      files.push(
        buildSnapshotFile(workspaceRoot, record.slice(2), {
          changeType: "untracked",
          gitState: "??",
        })
      );
      continue;
    }

    if (record.startsWith("1 ")) {
      const parsed = splitRecordPrefix(record, 8);
      if (!parsed) {
        continue;
      }

      files.push(
        buildSnapshotFile(workspaceRoot, parsed.remainder, {
          changeType: deriveChangeTypeFromGitStatus(parsed.fields[1]),
          gitState: normalizeGitState(parsed.fields[1]),
        })
      );
      continue;
    }

    if (record.startsWith("2 ")) {
      const parsed = splitRecordPrefix(record, 9);
      if (!parsed) {
        continue;
      }

      const previousPath = records[index + 1] || "";
      index += 1;
      files.push(
        buildSnapshotFile(workspaceRoot, parsed.remainder, {
          changeType: "renamed",
          gitState: normalizeGitState(parsed.fields[1]) || "R",
          previousPath: normalizeSnapshotPath(previousPath),
        })
      );
      continue;
    }

    if (record.startsWith("u ")) {
      const parsed = splitRecordPrefix(record, 10);
      if (!parsed) {
        continue;
      }

      files.push(
        buildSnapshotFile(workspaceRoot, parsed.remainder, {
          changeType: "modified",
          gitState: normalizeGitState(parsed.fields[1]),
        })
      );
    }
  }

  return files;
}

function splitRecordPrefix(record, fieldCount) {
  const fields = [];
  let startIndex = 0;

  for (let index = 0; index < fieldCount; index += 1) {
    const separatorIndex = record.indexOf(" ", startIndex);
    if (separatorIndex === -1) {
      return null;
    }

    fields.push(record.slice(startIndex, separatorIndex));
    startIndex = separatorIndex + 1;
  }

  return {
    fields,
    remainder: record.slice(startIndex),
  };
}

function deriveChangeTypeFromGitStatus(gitStatus) {
  const normalized = normalizeGitState(gitStatus);

  if (normalized === "D") {
    return "deleted";
  }

  if (normalized === "A") {
    return "added";
  }

  if (normalized === "R") {
    return "renamed";
  }

  if (normalized === "??") {
    return "untracked";
  }

  return "modified";
}

function normalizeGitState(gitStatus) {
  const normalized = String(gitStatus || "").replace(/\./g, "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized === "??") {
    return "??";
  }

  return normalized.includes("R")
    ? "R"
    : normalized.includes("D")
      ? "D"
      : normalized.includes("A")
        ? "A"
        : normalized.includes("M")
          ? "M"
          : normalized;
}

function buildSnapshotFile(workspaceRoot, relativePath, options = {}) {
  const normalizedPath = normalizeSnapshotPath(relativePath);
  const absolutePath = normalizedPath
    ? path.join(workspaceRoot, normalizedPath.split("/").join(path.sep))
    : "";
  const fileStats = getSnapshotFileStats(absolutePath);

  return {
    path: normalizedPath,
    changeType: options.changeType || "modified",
    gitState: options.gitState || null,
    previousPath: normalizeSnapshotPath(options.previousPath),
    exists: Boolean(fileStats),
    modifiedAt: fileStats ? new Date(fileStats.mtimeMs).toISOString() : null,
    modifiedAtMs: fileStats ? fileStats.mtimeMs : null,
    contentFingerprint: fileStats ? hashFileWithCache(absolutePath, fileStats) : null,
  };
}

function getSnapshotFileStats(absolutePath) {
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return null;
  }

  const stats = fs.statSync(absolutePath);
  return stats.isFile() ? stats : null;
}

function hashFileWithCache(filePath, stats = null) {
  const fileStats = stats || getSnapshotFileStats(filePath);
  if (!fileStats) {
    return null;
  }

  const cacheKey = buildFingerprintCacheKey(filePath, fileStats);
  if (fileFingerprintCache.has(cacheKey)) {
    const cachedFingerprint = fileFingerprintCache.get(cacheKey);
    fileFingerprintCache.delete(cacheKey);
    fileFingerprintCache.set(cacheKey, cachedFingerprint);
    return cachedFingerprint;
  }

  const fingerprint = `sha1:${crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex")}`;
  fileFingerprintCache.set(cacheKey, fingerprint);
  trimFingerprintCache();
  return fingerprint;
}

function buildDirectProofAnchor(workspaceRoot, relativePath) {
  const normalizedPath = normalizeSnapshotPath(relativePath);
  const absolutePath = normalizedPath
    ? path.join(workspaceRoot, normalizedPath.split("/").join(path.sep))
    : "";
  const stats = getSnapshotFileStats(absolutePath);
  if (!stats) {
    return null;
  }

  return {
    path: normalizedPath,
    exists: true,
    contentFingerprint: hashFileWithCache(absolutePath, stats),
  };
}

function buildFingerprintCacheKey(filePath, stats) {
  return [
    path.resolve(filePath),
    Number.isFinite(stats && stats.mtimeMs) ? stats.mtimeMs : "no-mtime",
    Number.isFinite(stats && stats.size) ? stats.size : "no-size",
  ].join("::");
}

function trimFingerprintCache() {
  while (fileFingerprintCache.size > FILE_FINGERPRINT_CACHE_LIMIT) {
    const oldestCacheKey = fileFingerprintCache.keys().next().value;
    if (!oldestCacheKey) {
      return;
    }
    fileFingerprintCache.delete(oldestCacheKey);
  }
}

function normalizeSnapshotPath(value) {
  const normalized = String(value || "").replace(/\\/g, "/").trim();
  return normalized || null;
}

function walkWorkspaceFiles(workspaceRoot, relativeDir = "") {
  const directoryPath = relativeDir ? path.join(workspaceRoot, relativeDir) : workspaceRoot;

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.name !== ".git" && entry.name !== "node_modules")
    .flatMap((entry) => {
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        return walkWorkspaceFiles(workspaceRoot, relativePath);
      }

      if (!entry.isFile()) {
        return [];
      }

      const absolutePath = path.join(workspaceRoot, relativePath);
      const stats = fs.statSync(absolutePath);
      return [
        {
          path: relativePath.replace(/\\/g, "/"),
          changeType: "modified",
          gitState: null,
          previousPath: null,
          exists: true,
          modifiedAt: new Date(stats.mtimeMs).toISOString(),
          modifiedAtMs: stats.mtimeMs,
          contentFingerprint: null,
        },
      ];
    });
}

module.exports = {
  buildProofAnchor,
  buildScopeProofAnchors,
  loadGitRepositorySnapshot,
  loadFilesystemSnapshot,
  loadRepositorySnapshot,
  parseGitStatusPorcelainV2,
};
