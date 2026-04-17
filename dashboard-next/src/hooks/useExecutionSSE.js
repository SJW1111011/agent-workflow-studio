import { useEffect, useState } from "preact/hooks";

function createIdleState() {
  return {
    error: null,
    event: null,
    eventCount: 0,
    status: "idle",
    supported: true,
  };
}

function buildExecutionEventsUrl(taskId) {
  return `/api/tasks/${encodeURIComponent(taskId)}/execution/events`;
}

export default function useExecutionSSE(taskId) {
  const [state, setState] = useState(createIdleState);

  useEffect(() => {
    if (!taskId) {
      setState(createIdleState());
      return undefined;
    }

    const EventSourceImpl = globalThis.EventSource;
    if (typeof EventSourceImpl !== "function") {
      setState({
        error: "EventSource is unavailable in this browser.",
        event: null,
        eventCount: 0,
        status: "unsupported",
        supported: false,
      });
      return undefined;
    }

    let disposed = false;
    let hasOpened = false;
    const source = new EventSourceImpl(buildExecutionEventsUrl(taskId));

    setState({
      error: null,
      event: null,
      eventCount: 0,
      status: "connecting",
      supported: true,
    });

    const handleOpen = () => {
      if (disposed) {
        return;
      }

      hasOpened = true;
      setState((current) => ({
        ...current,
        error: null,
        status: "open",
        supported: true,
      }));
    };

    const handleStateEvent = (message) => {
      if (disposed) {
        return;
      }

      try {
        const payload = JSON.parse(message.data);
        hasOpened = true;
        setState((current) => ({
          ...current,
          error: null,
          event: payload,
          eventCount: current.eventCount + 1,
          status: "open",
          supported: true,
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : "Failed to parse execution SSE payload.",
          status: hasOpened ? "open" : "error",
        }));
      }
    };

    const handleError = () => {
      if (disposed) {
        return;
      }

      setState((current) => ({
        ...current,
        error: hasOpened ? current.error : "Execution event stream is unavailable.",
        status: hasOpened ? "connecting" : "error",
        supported: true,
      }));
    };

    source.addEventListener("open", handleOpen);
    source.addEventListener("state", handleStateEvent);
    source.addEventListener("error", handleError);

    return () => {
      disposed = true;
      source.removeEventListener("open", handleOpen);
      source.removeEventListener("state", handleStateEvent);
      source.removeEventListener("error", handleError);
      source.close();
    };
  }, [taskId]);

  return state;
}
