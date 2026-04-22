import { useRef, useState } from "preact/hooks";
import { createDashboardApiClient } from "../utils/api.js";

function decrementPendingCount(pendingCount) {
  return pendingCount > 0 ? pendingCount - 1 : 0;
}

export default function useApi() {
  const clientRef = useRef(null);
  const methodsRef = useRef(null);
  const [requestState, setRequestState] = useState({
    pendingCount: 0,
    lastError: null,
  });

  if (!clientRef.current) {
    const fetchImpl = typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null;
    clientRef.current = createDashboardApiClient(fetchImpl);
  }

  async function track(operation) {
    setRequestState((current) => ({
      ...current,
      pendingCount: current.pendingCount + 1,
    }));

    try {
      const result = await operation();
      setRequestState((current) => ({
        pendingCount: decrementPendingCount(current.pendingCount),
        lastError: null,
      }));
      return result;
    } catch (error) {
      setRequestState((current) => ({
        pendingCount: decrementPendingCount(current.pendingCount),
        lastError: error,
      }));
      throw error;
    }
  }

  if (!methodsRef.current) {
    methodsRef.current = {
      clearLastError() {
        setRequestState((current) => ({
          ...current,
          lastError: null,
        }));
      },
      fetchJson(...args) {
        return track(() => clientRef.current.fetchJson(...args));
      },
      loadOverview(...args) {
        return track(() => clientRef.current.loadOverview(...args));
      },
      loadTrustSummary(...args) {
        return track(() => clientRef.current.loadTrustSummary(...args));
      },
      loadRunLog(...args) {
        return track(() => clientRef.current.loadRunLog(...args));
      },
      loadTaskDetail(...args) {
        return track(() => clientRef.current.loadTaskDetail(...args));
      },
      loadTaskExecution(...args) {
        return track(() => clientRef.current.loadTaskExecution(...args));
      },
      loadTaskExecutionLog(...args) {
        return track(() => clientRef.current.loadTaskExecutionLog(...args));
      },
      patchJson(...args) {
        return track(() => clientRef.current.patchJson(...args));
      },
      postJson(...args) {
        return track(() => clientRef.current.postJson(...args));
      },
      putJson(...args) {
        return track(() => clientRef.current.putJson(...args));
      },
      quickCreateTask(...args) {
        return track(() => clientRef.current.quickCreateTask(...args));
      },
    };
  }

  return {
    ...methodsRef.current,
    requestState,
  };
}
