import { useEffect, useReducer, useRef } from "preact/hooks";
import useApi from "./useApi.js";
import useExecutionSSE from "./useExecutionSSE.js";
import {
  describeExecutionState,
  isActiveExecutionState,
  resolveExecutionLogSource,
} from "../utils/execution.js";
import {
  clearExecutionLogState,
  hasOpenExecutionLogStreams,
  isExecutionLogStreamOpen,
  loadResolvedExecutionLog,
  toggleExecutionLogStreamState,
} from "../utils/logs.js";
import {
  buildExecutionCompletionStatus,
  resolveNextActiveTaskId,
} from "../utils/orchestration.js";

function createLogState(taskId = null) {
  const execution = clearExecutionLogState(taskId);
  return {
    executionLogs: {},
    openStreams: Array.from(execution.openStreams),
    runLogs: {},
    taskId: execution.taskId,
  };
}

const initialState = {
  actionStatus: {
    message: "Loading dashboard data...",
    tone: "",
  },
  activeDocumentName: "task.md",
  activeExecutorOutcomeFilter: "all",
  activeTab: "overview",
  activeTaskId: null,
  executionState: null,
  logState: createLogState(),
  overview: {
    data: null,
    error: null,
    status: "loading",
  },
  taskDetail: {
    data: null,
    error: null,
    status: "idle",
  },
};

function reducer(state, action) {
  switch (action.type) {
    case "overview/loading":
      return {
        ...state,
        overview: {
          ...state.overview,
          error: null,
          status: "loading",
        },
      };
    case "overview/success":
      return {
        ...state,
        activeTaskId: action.payload.activeTaskId,
        overview: {
          data: action.payload.overview,
          error: null,
          status: "ready",
        },
      };
    case "overview/error":
      return {
        ...state,
        overview: {
          ...state.overview,
          error: action.payload,
          status: "error",
        },
      };
    case "task/select":
      return {
        ...state,
        activeTaskId: action.payload,
        logState:
          state.activeTaskId === action.payload &&
          state.logState.taskId === action.payload
            ? state.logState
            : createLogState(action.payload),
        taskDetail: {
          ...state.taskDetail,
          error: null,
          status: action.payload ? "loading" : "idle",
        },
      };
    case "task/detail/success":
      return {
        ...state,
        executionState: action.payload.executionState || null,
        logState:
          state.logState.taskId === action.payload.meta.id
            ? state.logState
            : createLogState(action.payload.meta.id),
        taskDetail: {
          data: action.payload,
          error: null,
          status: "ready",
        },
      };
    case "task/detail/error":
      return {
        ...state,
        taskDetail: {
          ...state.taskDetail,
          data: null,
          error: action.payload,
          status: "error",
        },
      };
    case "tab/set":
      return {
        ...state,
        activeTab: action.payload,
      };
    case "document/set":
      return {
        ...state,
        activeDocumentName: action.payload,
      };
    case "filter/set":
      return {
        ...state,
        activeExecutorOutcomeFilter: action.payload,
      };
    case "execution/set":
      return {
        ...state,
        executionState: action.payload,
        taskDetail: state.taskDetail.data
          ? {
              ...state.taskDetail,
              data: {
                ...state.taskDetail.data,
                executionState: action.payload,
              },
            }
          : state.taskDetail,
      };
    case "status/set":
      return {
        ...state,
        actionStatus: {
          message: action.payload.message,
          tone: action.payload.tone || "",
        },
      };
    case "logs/set":
      return {
        ...state,
        logState: action.payload,
      };
    default:
      return state;
  }
}

function normalizeLogStateShape(logState) {
  const current = logState || createLogState();
  return {
    executionLogs: current.executionLogs || {},
    openStreams: Array.isArray(current.openStreams) ? current.openStreams : [],
    runLogs: current.runLogs || {},
    taskId: current.taskId || null,
  };
}

function compactExecutionSnapshot(executionState) {
  const state =
    executionState && typeof executionState === "object" ? executionState : {};
  return {
    outcome: state.outcome || null,
    runId: state.runId || null,
    status: state.status || "idle",
    updatedAt: state.updatedAt || null,
  };
}

function executionSnapshotMatchesEvent(executionState, event) {
  if (!event || typeof event !== "object") {
    return false;
  }

  const current = compactExecutionSnapshot(executionState);
  return (
    current.outcome === (event.outcome || null) &&
    current.runId === (event.runId || null) &&
    current.status === (event.status || "idle") &&
    current.updatedAt === (event.updatedAt || null)
  );
}

export default function useDashboardState() {
  const api = useApi();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(initialState);
  const executionRefreshTokenRef = useRef(0);
  const executionSse = useExecutionSSE(state.activeTaskId);

  const {
    loadOverview,
    loadTrustSummary,
    loadRunLog,
    loadTaskDetail,
    loadTaskExecution,
    loadTaskExecutionLog,
    requestState,
  } = api;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  function setActionStatus(message, tone = "") {
    dispatch({
      type: "status/set",
      payload: { message, tone },
    });
  }

  async function refreshExecutionLogs(taskId, executionState = null) {
    const currentState = stateRef.current;
    const currentLogState = normalizeLogStateShape(currentState.logState);
    if (!hasOpenExecutionLogStreams(currentLogState, taskId)) {
      return;
    }

    const nextLogState = {
      ...currentLogState,
      executionLogs: { ...currentLogState.executionLogs },
    };

    Array.from(currentLogState.openStreams).forEach((stream) => {
      nextLogState.executionLogs[stream] = {
        data: nextLogState.executionLogs[stream]?.data || null,
        error: null,
        status: "loading",
      };
    });
    dispatch({ type: "logs/set", payload: nextLogState });

    await Promise.all(
      currentLogState.openStreams.map(async (stream) => {
        try {
          const logSource = resolveExecutionLogSource(
            taskId,
            executionState || currentState.executionState,
            stream,
          );
          const latestState = stateRef.current;
          const latestLogState = normalizeLogStateShape(latestState.logState);

          if (!logSource) {
            if (!isExecutionLogStreamOpen(latestLogState, taskId, stream)) {
              return;
            }

            dispatch({
              type: "logs/set",
              payload: {
                ...latestLogState,
                executionLogs: {
                  ...latestLogState.executionLogs,
                  [stream]: {
                    data: null,
                    error: null,
                    status: "unavailable",
                  },
                },
              },
            });
            return;
          }

          const log = await loadResolvedExecutionLog(logSource, {
            loadRunLog,
            loadTaskExecutionLog,
          });
          const refreshedState = stateRef.current;
          const refreshedLogState = normalizeLogStateShape(
            refreshedState.logState,
          );
          if (!isExecutionLogStreamOpen(refreshedLogState, taskId, stream)) {
            return;
          }

          dispatch({
            type: "logs/set",
            payload: {
              ...refreshedLogState,
              executionLogs: {
                ...refreshedLogState.executionLogs,
                [stream]: {
                  data: log,
                  error: null,
                  status: "ready",
                },
              },
            },
          });
        } catch (error) {
          const refreshedState = stateRef.current;
          const refreshedLogState = normalizeLogStateShape(
            refreshedState.logState,
          );
          if (!isExecutionLogStreamOpen(refreshedLogState, taskId, stream)) {
            return;
          }

          dispatch({
            type: "logs/set",
            payload: {
              ...refreshedLogState,
              executionLogs: {
                ...refreshedLogState.executionLogs,
                [stream]: {
                  data: null,
                  error: error.message,
                  status: "error",
                },
              },
            },
          });
        }
      }),
    );
  }

  async function loadSelectedTask(taskId, options = {}) {
    if (!taskId) {
      dispatch({
        type: "task/detail/success",
        payload: {
          executionState: null,
          meta: { id: "" },
        },
      });
      return null;
    }

    if (!options.keepLoadingState) {
      dispatch({ type: "task/select", payload: taskId });
    }

    try {
      const detail = await loadTaskDetail(taskId);
      if (stateRef.current.activeTaskId !== taskId) {
        return detail;
      }

      dispatch({
        type: "task/detail/success",
        payload: detail,
      });
      return detail;
    } catch (error) {
      if (stateRef.current.activeTaskId === taskId) {
        dispatch({
          type: "task/detail/error",
          payload: error.message,
        });
      }
      throw error;
    }
  }

  async function refreshDashboard(requestedTaskId = null) {
    dispatch({ type: "overview/loading" });

    try {
      const [overview, trustSummaryResult] = await Promise.all([
        loadOverview(),
        loadTrustSummary()
          .then((value) => ({ error: null, value }))
          .catch((error) => ({ error: error.message, value: null })),
      ]);

      const nextOverview = {
        ...overview,
        trustSummary: trustSummaryResult.value,
        trustSummaryError: trustSummaryResult.error,
      };
      const currentActiveTaskId = stateRef.current.activeTaskId;
      const nextActiveTaskId = resolveNextActiveTaskId(
        nextOverview.tasks || [],
        requestedTaskId,
        currentActiveTaskId,
      );

      dispatch({
        type: "overview/success",
        payload: {
          activeTaskId: nextActiveTaskId,
          overview: nextOverview,
        },
      });

      if (!nextActiveTaskId) {
        dispatch({ type: "task/select", payload: null });
        dispatch({ type: "execution/set", payload: null });
        return nextOverview;
      }

      dispatch({ type: "task/select", payload: nextActiveTaskId });
      await loadSelectedTask(nextActiveTaskId, { keepLoadingState: true });
      return nextOverview;
    } catch (error) {
      dispatch({
        type: "overview/error",
        payload: error.message,
      });
      setActionStatus(error.message, "error");
      throw error;
    }
  }

  async function selectTask(taskId) {
    dispatch({ type: "task/select", payload: taskId });

    try {
      await loadSelectedTask(taskId, { keepLoadingState: true });
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  function setActiveTab(tabId) {
    dispatch({ type: "tab/set", payload: tabId });
  }

  function setActiveDocumentName(documentName) {
    dispatch({ type: "document/set", payload: documentName || "task.md" });
  }

  function setActiveExecutorOutcomeFilter(filterValue) {
    dispatch({ type: "filter/set", payload: filterValue || "all" });
  }

  function updateSelectedExecutionState(taskId, executionState) {
    const activeTaskId = stateRef.current.activeTaskId;
    if (activeTaskId && activeTaskId === taskId) {
      dispatch({ type: "execution/set", payload: executionState });
    }
  }

  async function syncExecutionState(taskId, options = {}) {
    if (!taskId) {
      return null;
    }

    const previousExecutionState =
      options.previousExecutionState || stateRef.current.executionState;
    const requestToken = ++executionRefreshTokenRef.current;

    try {
      const nextState = await loadTaskExecution(taskId);
      if (
        stateRef.current.activeTaskId !== taskId ||
        executionRefreshTokenRef.current !== requestToken
      ) {
        return nextState;
      }

      dispatch({ type: "execution/set", payload: nextState });
      await refreshExecutionLogs(taskId, nextState);

      if (
        options.refreshDashboardOnCompletion &&
        isActiveExecutionState(previousExecutionState) &&
        !isActiveExecutionState(nextState)
      ) {
        const completionStatus = buildExecutionCompletionStatus(
          nextState,
          taskId,
          describeExecutionState,
        );
        await refreshDashboard(taskId);
        if (completionStatus) {
          setActionStatus(completionStatus.message, completionStatus.tone);
        }
      }

      return nextState;
    } catch (error) {
      if (options.reportErrors !== false) {
        setActionStatus(error.message, "error");
      }
      throw error;
    }
  }

  async function toggleExecutionStream(taskId, stream) {
    const currentLogState = normalizeLogStateShape(stateRef.current.logState);
    const toggled = toggleExecutionLogStreamState(
      currentLogState,
      taskId,
      stream,
    );
    const nextLogState = {
      ...currentLogState,
      executionLogs: { ...currentLogState.executionLogs },
      openStreams: Array.from(toggled.openStreams),
      taskId: toggled.taskId,
    };

    if (!nextLogState.openStreams.includes(stream)) {
      delete nextLogState.executionLogs[stream];
      dispatch({ type: "logs/set", payload: nextLogState });
      return;
    }

    nextLogState.executionLogs[stream] = {
      data: nextLogState.executionLogs[stream]?.data || null,
      error: null,
      status: "loading",
    };
    dispatch({ type: "logs/set", payload: nextLogState });
    await refreshExecutionLogs(taskId, stateRef.current.executionState);
  }

  async function toggleRunLog(taskId, runId, stream) {
    const key = `${runId}:${stream}`;
    const currentLogState = normalizeLogStateShape(stateRef.current.logState);
    const existing = currentLogState.runLogs[key];

    if (existing && existing.open) {
      dispatch({
        type: "logs/set",
        payload: {
          ...currentLogState,
          runLogs: {
            ...currentLogState.runLogs,
            [key]: {
              ...existing,
              open: false,
            },
          },
        },
      });
      return;
    }

    dispatch({
      type: "logs/set",
      payload: {
        ...currentLogState,
        runLogs: {
          ...currentLogState.runLogs,
          [key]: {
            data: existing?.data || null,
            error: null,
            open: true,
            status: "loading",
            stream,
          },
        },
      },
    });

    try {
      const log = await loadRunLog(taskId, runId, stream);
      const latestLogState = normalizeLogStateShape(stateRef.current.logState);
      dispatch({
        type: "logs/set",
        payload: {
          ...latestLogState,
          runLogs: {
            ...latestLogState.runLogs,
            [key]: {
              data: log,
              error: null,
              open: true,
              status: "ready",
              stream,
            },
          },
        },
      });
    } catch (error) {
      const latestLogState = normalizeLogStateShape(stateRef.current.logState);
      dispatch({
        type: "logs/set",
        payload: {
          ...latestLogState,
          runLogs: {
            ...latestLogState.runLogs,
            [key]: {
              data: null,
              error: error.message,
              open: true,
              status: "error",
              stream,
            },
          },
        },
      });
    }
  }

  useEffect(() => {
    refreshDashboard()
      .then(() => {
        setActionStatus("Ready.", "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const taskId = state.activeTaskId;
    const nextEvent = executionSse.event;
    if (!taskId || !nextEvent || executionSse.eventCount === 0) {
      return undefined;
    }

    if (nextEvent.taskId && nextEvent.taskId !== taskId) {
      return undefined;
    }

    const currentExecutionState = stateRef.current.executionState;
    if (executionSnapshotMatchesEvent(currentExecutionState, nextEvent)) {
      return undefined;
    }

    syncExecutionState(taskId, {
      previousExecutionState: currentExecutionState,
      refreshDashboardOnCompletion: true,
      reportErrors: true,
    }).catch(() => {});

    return undefined;
  }, [executionSse.eventCount, state.activeTaskId]);

  useEffect(() => {
    const taskId = state.activeTaskId;
    const executionState = state.executionState;
    if (
      !taskId ||
      !isActiveExecutionState(executionState) ||
      executionSse.status === "open"
    ) {
      return undefined;
    }

    const pollHandle = setTimeout(async () => {
      syncExecutionState(taskId, {
        previousExecutionState: executionState,
        refreshDashboardOnCompletion: true,
        reportErrors: true,
      }).catch(() => {});
    }, 900);

    return () => {
      clearTimeout(pollHandle);
    };
  }, [
    executionSse.status,
    state.activeTaskId,
    state.executionState?.activity,
    state.executionState?.runId,
    state.executionState?.status,
    state.executionState?.updatedAt,
    state.logState.openStreams.join("|"),
  ]);

  return {
    api,
    executionConnectionError: executionSse.error,
    executionConnectionStatus: executionSse.status,
    requestState,
    state,
    refreshDashboard,
    refreshExecutionLogs,
    selectTask,
    setActionStatus,
    setActiveDocumentName,
    setActiveExecutorOutcomeFilter,
    setActiveTab,
    toggleExecutionStream,
    toggleRunLog,
    updateSelectedExecutionState,
  };
}
