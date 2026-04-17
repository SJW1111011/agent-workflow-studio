import { useEffect, useState } from "preact/hooks";

function cloneEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  return {
    data: entry.data && typeof entry.data === "object" ? { ...entry.data } : entry.data || null,
    error: entry.error || null,
    status: entry.status || "idle",
  };
}

function createIdleState(initialEntry = null) {
  return {
    connectionStatus: "idle",
    entry: cloneEntry(initialEntry),
    error: null,
    supported: true,
  };
}

function createLoadingEntry(initialEntry = null) {
  return cloneEntry(initialEntry) || { data: null, error: null, status: "loading" };
}

function buildExecutionLogStreamUrl(taskId, stream) {
  return `/api/tasks/${encodeURIComponent(taskId)}/execution/logs/${encodeURIComponent(stream)}/stream`;
}

function createExecutionLogEntry(log) {
  return {
    data: log && typeof log === "object" ? { ...log, source: "execution" } : null,
    error: null,
    status: "ready",
  };
}

function createEmptyExecutionLog(taskId, stream) {
  return {
    active: true,
    content: "",
    path: null,
    pending: true,
    runId: null,
    size: 0,
    source: "execution",
    stream,
    taskId,
    truncated: false,
    updatedAt: null,
  };
}

function appendLiveLogEntry(entry, taskId, stream, payload) {
  const currentEntry = cloneEntry(entry) || { data: null, error: null, status: "ready" };
  const currentLog =
    currentEntry.data && typeof currentEntry.data === "object"
      ? { ...currentEntry.data }
      : createEmptyExecutionLog(taskId, stream);
  const currentContent = typeof currentLog.content === "string" ? currentLog.content : "";
  const nextLine = typeof payload?.line === "string" ? payload.line : "";
  const hasTrailingNewline = currentContent.endsWith("\n");
  const lastNewlineIndex = currentContent.lastIndexOf("\n");
  const stableContent = hasTrailingNewline
    ? currentContent
    : lastNewlineIndex >= 0
      ? currentContent.slice(0, lastNewlineIndex + 1)
      : "";
  const replacedTailLength = currentContent.length - stableContent.length;
  const sizeBase = Math.max(Number(currentLog.size) || 0, currentContent.length);
  const sizeDelta = hasTrailingNewline
    ? nextLine.length + 1
    : Math.max(nextLine.length + 1 - replacedTailLength, 0);

  return {
    error: null,
    status: "ready",
    data: {
      ...currentLog,
      active: true,
      pending: false,
      runId: payload?.runId || currentLog.runId || null,
      size: sizeBase + sizeDelta,
      source: "execution",
      stream,
      taskId,
      updatedAt: payload?.receivedAt || currentLog.updatedAt || null,
      content: `${stableContent}${nextLine}\n`,
    },
  };
}

function areEntriesEquivalent(left, right) {
  const leftData = left?.data || null;
  const rightData = right?.data || null;

  return (
    left?.status === right?.status &&
    left?.error === right?.error &&
    leftData?.content === rightData?.content &&
    leftData?.path === rightData?.path &&
    leftData?.pending === rightData?.pending &&
    leftData?.runId === rightData?.runId &&
    leftData?.size === rightData?.size &&
    leftData?.updatedAt === rightData?.updatedAt
  );
}

export default function useLogSSE(taskId, stream, options = {}) {
  const { enabled = true, initialEntry = null, loadSnapshot } = options;
  const [state, setState] = useState(() => createIdleState(initialEntry));

  useEffect(() => {
    if (!enabled || !taskId || !stream) {
      setState(createIdleState(initialEntry));
      return undefined;
    }

    setState({
      connectionStatus: "connecting",
      entry: createLoadingEntry(initialEntry),
      error: null,
      supported: true,
    });

    const EventSourceImpl = globalThis.EventSource;
    if (typeof EventSourceImpl !== "function") {
      setState((current) => ({
        ...current,
        connectionStatus: "unsupported",
        error: "EventSource is unavailable in this browser.",
        supported: false,
      }));
      return undefined;
    }

    let disposed = false;
    let hasOpened = false;
    const source = new EventSourceImpl(buildExecutionLogStreamUrl(taskId, stream));

    const handleOpen = () => {
      if (disposed) {
        return;
      }

      hasOpened = true;
      setState((current) => ({
        ...current,
        connectionStatus: "open",
        error: null,
        supported: true,
      }));
    };

    const handleLogEvent = (message) => {
      if (disposed) {
        return;
      }

      try {
        const payload = JSON.parse(message.data);
        hasOpened = true;
        setState((current) => ({
          ...current,
          connectionStatus: "open",
          entry: appendLiveLogEntry(current.entry, taskId, stream, payload),
          error: null,
          supported: true,
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          connectionStatus: hasOpened ? "open" : "error",
          error: error instanceof Error ? error.message : "Failed to parse execution log SSE payload.",
        }));
      }
    };

    const handleError = () => {
      if (disposed) {
        return;
      }

      setState((current) => ({
        ...current,
        connectionStatus: hasOpened ? "connecting" : "error",
        error: hasOpened ? current.error : "Execution log stream is unavailable.",
        supported: true,
      }));
    };

    source.addEventListener("open", handleOpen);
    source.addEventListener("log", handleLogEvent);
    source.addEventListener("error", handleError);

    return () => {
      disposed = true;
      source.removeEventListener("open", handleOpen);
      source.removeEventListener("log", handleLogEvent);
      source.removeEventListener("error", handleError);
      source.close();
    };
  }, [enabled, stream, taskId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const nextEntry = cloneEntry(initialEntry);
    if (!nextEntry) {
      return;
    }

    setState((current) => {
      if (current.connectionStatus === "open" || areEntriesEquivalent(current.entry, nextEntry)) {
        return current;
      }

      return {
        ...current,
        entry: nextEntry,
      };
    });
  }, [
    enabled,
    initialEntry?.data?.content,
    initialEntry?.data?.path,
    initialEntry?.data?.pending,
    initialEntry?.data?.runId,
    initialEntry?.data?.size,
    initialEntry?.data?.updatedAt,
    initialEntry?.error,
    initialEntry?.status,
    stream,
    taskId,
  ]);

  useEffect(() => {
    if (!enabled || !taskId || !stream || typeof loadSnapshot !== "function") {
      return undefined;
    }

    let cancelled = false;
    let pollHandle = null;

    async function refreshSnapshot() {
      try {
        const log = await loadSnapshot(taskId, stream);
        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          entry: createExecutionLogEntry(log),
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState((current) => ({
          ...current,
          entry: {
            data: null,
            error: error instanceof Error ? error.message : "Unable to load log output.",
            status: "error",
          },
        }));
      } finally {
        if (!cancelled && state.connectionStatus !== "open") {
          pollHandle = setTimeout(refreshSnapshot, 900);
        }
      }
    }

    refreshSnapshot();

    return () => {
      cancelled = true;
      if (pollHandle) {
        clearTimeout(pollHandle);
      }
    };
  }, [enabled, loadSnapshot, state.connectionStatus, stream, taskId]);

  return state;
}
