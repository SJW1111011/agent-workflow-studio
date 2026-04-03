const fs = require("fs");
const path = require("path");
const { fileExists, readText } = require("./fs-utils");
const { memoryRoot, taskFiles } = require("./workspace");

const MEMORY_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const TASK_DOC_STALE_MS = 7 * 24 * 60 * 60 * 1000;
const SYNC_GRACE_MS = 60 * 1000;

function loadMemoryFreshness(workspaceRoot, placeholderMarkers = []) {
  const root = memoryRoot(workspaceRoot);
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const absolutePath = path.join(root, entry.name);
      const content = readText(absolutePath, "");
      const placeholder = placeholderMarkers.some((marker) => content.includes(marker));
      const stats = fs.statSync(absolutePath);
      const ageMs = Date.now() - stats.mtimeMs;
      const freshnessStatus = placeholder ? "placeholder" : ageMs > MEMORY_STALE_MS ? "stale" : "fresh";

      return {
        name: entry.name,
        relativePath: path.join(".agent-workflow", "memory", entry.name).replace(/\\/g, "/"),
        placeholder,
        freshnessStatus,
        freshnessReason: placeholder
          ? "Still contains scaffold guidance."
          : freshnessStatus === "stale"
            ? `Not updated for ${formatAge(ageMs)}.`
            : `Updated ${formatAge(ageMs)} ago.`,
        modifiedAt: new Date(stats.mtimeMs).toISOString(),
        ageMs,
        size: content.length,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildTaskFreshness(workspaceRoot, taskMeta, runs = []) {
  const files = taskFiles(workspaceRoot, taskMeta.id);
  const latestRun = runs[runs.length - 1] || null;
  const taskUpdatedAtMs = parseTime(taskMeta.updatedAt);
  const latestRunMs = latestRun ? parseTime(latestRun.completedAt || latestRun.createdAt) : null;

  const docs = [
    assessDoc("task.md", files.task, relativeTaskPath(taskMeta.id, "task.md"), {
      staleAfterMs: TASK_DOC_STALE_MS,
    }),
    assessDoc("context.md", files.context, relativeTaskPath(taskMeta.id, "context.md"), {
      staleAfterMs: TASK_DOC_STALE_MS,
      compareAfterMs: taskMeta.status === "done" ? null : latestRunMs,
      compareReason: "Context is older than the latest execution evidence.",
    }),
    assessDoc("verification.md", files.verification, relativeTaskPath(taskMeta.id, "verification.md"), {
      staleAfterMs: TASK_DOC_STALE_MS,
      compareAfterMs: latestRunMs,
      compareReason: "Verification notes are older than the latest execution evidence.",
    }),
    assessDoc("checkpoint.md", files.checkpoint, relativeTaskPath(taskMeta.id, "checkpoint.md"), {
      staleAfterMs: TASK_DOC_STALE_MS,
      compareAfterMs: latestRunMs || taskUpdatedAtMs,
      compareReason: "Checkpoint is older than the latest task activity.",
    }),
  ];

  const staleDocs = docs.filter((doc) => doc.status !== "fresh");

  return {
    summary: {
      status: staleDocs.length > 0 ? "stale" : "fresh",
      staleCount: staleDocs.length,
      message:
        staleDocs.length > 0
          ? `${staleDocs.length} task doc(s) need refresh.`
          : "Task docs look current under the current heuristics.",
    },
    docs,
  };
}

function assessDoc(name, absolutePath, relativePath, options = {}) {
  if (!fileExists(absolutePath)) {
    return {
      name,
      exists: false,
      status: "missing",
      reason: "Document is missing.",
      modifiedAt: null,
      ageMs: null,
      relativePath,
    };
  }

  const stats = fs.statSync(absolutePath);
  const modifiedAtMs = stats.mtimeMs;
  const ageMs = Date.now() - modifiedAtMs;
  let status = "fresh";
  let reason = `Updated ${formatAge(ageMs)} ago.`;

  if (options.compareAfterMs && modifiedAtMs + SYNC_GRACE_MS < options.compareAfterMs) {
    status = "stale";
    reason = options.compareReason || "Document looks older than recent workflow activity.";
  } else if (options.staleAfterMs && ageMs > options.staleAfterMs) {
    status = "stale";
    reason = `Not updated for ${formatAge(ageMs)}.`;
  }

  return {
    name,
    exists: true,
    status,
    reason,
    modifiedAt: new Date(modifiedAtMs).toISOString(),
    ageMs,
    relativePath,
  };
}

function formatAge(ageMs) {
  const minutes = Math.floor(ageMs / (60 * 1000));
  if (minutes < 1) {
    return "less than a minute";
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function parseTime(value) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function relativeTaskPath(taskId, fileName) {
  return path.join(".agent-workflow", "tasks", taskId, fileName).replace(/\\/g, "/");
}

module.exports = {
  buildTaskFreshness,
  loadMemoryFreshness,
};
