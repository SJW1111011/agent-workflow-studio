export function createExecutionLogState(taskId = null, openStreams = []) {
  return {
    taskId: taskId || null,
    openStreams: normalizeOpenStreams(openStreams),
  };
}

export function clearExecutionLogState(nextTaskId = null) {
  return createExecutionLogState(nextTaskId, []);
}

export function ensureExecutionLogTaskState(state, taskId) {
  const current = normalizeExecutionLogState(state);
  return current.taskId === taskId ? current : createExecutionLogState(taskId, []);
}

export function toggleExecutionLogStreamState(state, taskId, stream) {
  const current = ensureExecutionLogTaskState(state, taskId);
  const openStreams = new Set(current.openStreams);

  if (openStreams.has(stream)) {
    openStreams.delete(stream);
  } else {
    openStreams.add(stream);
  }

  return createExecutionLogState(taskId, openStreams);
}

export function hasOpenExecutionLogStreams(state, taskId) {
  const current = normalizeExecutionLogState(state);
  return Boolean(taskId) && current.taskId === taskId && current.openStreams.size > 0;
}

export function isExecutionLogStreamOpen(state, taskId, stream) {
  const current = normalizeExecutionLogState(state);
  return Boolean(taskId) && current.taskId === taskId && current.openStreams.has(stream);
}

export async function loadResolvedExecutionLog(logSource, loaders = {}) {
  if (!logSource || !logSource.kind) {
    throw new Error("Execution log source is unavailable.");
  }

  if (logSource.kind === "run") {
    if (typeof loaders.loadRunLog !== "function") {
      throw new Error("Run log loader is unavailable.");
    }

    const log = await loaders.loadRunLog(logSource.taskId, logSource.runId, logSource.stream);
    return {
      ...log,
      source: "run",
      active: false,
      pending: false,
    };
  }

  if (typeof loaders.loadTaskExecutionLog !== "function") {
    throw new Error("Execution log loader is unavailable.");
  }

  const log = await loaders.loadTaskExecutionLog(logSource.taskId, logSource.stream);
  return {
    ...log,
    source: "execution",
  };
}

function normalizeExecutionLogState(state) {
  if (!state || typeof state !== "object") {
    return createExecutionLogState();
  }

  return {
    taskId: state.taskId || null,
    openStreams: normalizeOpenStreams(state.openStreams),
  };
}

function normalizeOpenStreams(value) {
  if (value instanceof Set) {
    return new Set(value);
  }

  return new Set(Array.isArray(value) ? value : []);
}
