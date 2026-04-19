export const TASK_VIEW_STORAGE_KEY = "agent-workflow-studio:task-view";

export const TASK_VIEW_OPTIONS = [
  {
    id: "list",
    label: "List",
    description: "Scan every task card in one grid.",
  },
  {
    id: "kanban",
    label: "Kanban",
    description: "Group work by workflow status.",
  },
  {
    id: "timeline",
    label: "Timeline",
    description: "See task creation dates and run activity on one axis.",
  },
];

export const TASK_STATUS_COLUMNS = [
  {
    id: "todo",
    label: "To do",
    description: "Queued work that still needs forward motion.",
  },
  {
    id: "in_progress",
    label: "In progress",
    description: "Active work, blocked work, and follow-up loops.",
  },
  {
    id: "done",
    label: "Done",
    description: "Completed tasks with a recorded final status.",
  },
];

const NORMALIZED_TASK_VIEWS = new Set(TASK_VIEW_OPTIONS.map((option) => option.id));
const DONE_STATUSES = new Set(["complete", "completed", "done", "verified"]);
const IN_PROGRESS_STATUSES = new Set([
  "active",
  "blocked",
  "doing",
  "in_progress",
  "in_review",
  "inprogress",
  "review",
]);
const TODO_STATUSES = new Set([
  "backlog",
  "draft",
  "planned",
  "ready",
  "todo",
]);

export function normalizeTaskView(value) {
  const normalized = String(value || "list").trim().toLowerCase();
  return NORMALIZED_TASK_VIEWS.has(normalized) ? normalized : "list";
}

export function normalizeTaskStatus(value) {
  const normalized = String(value || "todo")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (DONE_STATUSES.has(normalized)) {
    return "done";
  }
  if (IN_PROGRESS_STATUSES.has(normalized)) {
    return "in_progress";
  }
  if (TODO_STATUSES.has(normalized)) {
    return "todo";
  }
  return "todo";
}

export function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function sortTasksByCreatedAt(tasks) {
  return (Array.isArray(tasks) ? tasks : []).slice().sort((left, right) => {
    const leftCreatedAt =
      parseTimestamp(left && left.createdAt) ??
      parseTimestamp(left && left.updatedAt) ??
      Number.MAX_SAFE_INTEGER;
    const rightCreatedAt =
      parseTimestamp(right && right.createdAt) ??
      parseTimestamp(right && right.updatedAt) ??
      Number.MAX_SAFE_INTEGER;

    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt;
    }

    return String((left && left.id) || "").localeCompare(String((right && right.id) || ""));
  });
}

export function groupTasksByStatus(tasks) {
  const grouped = new Map(
    TASK_STATUS_COLUMNS.map((column) => [column.id, []]),
  );

  sortTasksByCreatedAt(tasks).forEach((task) => {
    const status = normalizeTaskStatus(task && task.status);
    grouped.get(status).push(task);
  });

  return TASK_STATUS_COLUMNS.map((column) => ({
    ...column,
    count: grouped.get(column.id).length,
    tasks: grouped.get(column.id),
  }));
}

export function sortRunsByCreatedAt(runs) {
  return (Array.isArray(runs) ? runs : []).slice().sort((left, right) => {
    const leftCreatedAt =
      parseTimestamp(left && (left.completedAt || left.createdAt)) ??
      Number.MAX_SAFE_INTEGER;
    const rightCreatedAt =
      parseTimestamp(right && (right.completedAt || right.createdAt)) ??
      Number.MAX_SAFE_INTEGER;

    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt - rightCreatedAt;
    }

    return String((left && left.id) || "").localeCompare(String((right && right.id) || ""));
  });
}

export function groupRunsByTaskId(runs) {
  const grouped = new Map();

  sortRunsByCreatedAt(runs).forEach((run) => {
    const taskId = String((run && run.taskId) || "").trim();
    if (!taskId) {
      return;
    }

    const entries = grouped.get(taskId) || [];
    entries.push(run);
    grouped.set(taskId, entries);
  });

  return grouped;
}

export function buildTimelineBounds(tasks, runs) {
  const timestamps = [];

  sortTasksByCreatedAt(tasks).forEach((task) => {
    const createdAt =
      parseTimestamp(task && task.createdAt) ??
      parseTimestamp(task && task.updatedAt);
    if (createdAt !== null) {
      timestamps.push(createdAt);
    }

    const updatedAt = parseTimestamp(task && task.updatedAt);
    if (updatedAt !== null) {
      timestamps.push(updatedAt);
    }
  });

  sortRunsByCreatedAt(runs).forEach((run) => {
    const createdAt = parseTimestamp(run && (run.completedAt || run.createdAt));
    if (createdAt !== null) {
      timestamps.push(createdAt);
    }
  });

  if (timestamps.length === 0) {
    return null;
  }

  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  if (earliest === latest) {
    const hour = 60 * 60 * 1000;
    return {
      max: latest + hour,
      min: earliest - hour,
    };
  }

  const padding = Math.max((latest - earliest) * 0.08, 30 * 60 * 1000);
  return {
    max: latest + padding,
    min: earliest - padding,
  };
}

export function getTimelinePosition(value, bounds) {
  if (!bounds) {
    return 0;
  }

  const timestamp = typeof value === "number" ? value : parseTimestamp(value);
  if (timestamp === null) {
    return 0;
  }

  const range = Math.max(bounds.max - bounds.min, 1);
  const ratio = (timestamp - bounds.min) / range;
  return Math.max(0, Math.min(100, ratio * 100));
}

export function buildTimelineAxis(bounds, markerCount = 5) {
  if (!bounds) {
    return [];
  }

  const count = Math.max(2, Number(markerCount) || 0);
  const range = bounds.max - bounds.min;
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    return {
      position: ratio * 100,
      timestamp: bounds.min + range * ratio,
    };
  });
}
