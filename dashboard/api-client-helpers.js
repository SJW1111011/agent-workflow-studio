(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AgentWorkflowDashboardApiClientHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createDashboardApiClient(fetchImpl) {
    const request = createJsonRequester(fetchImpl);

    return {
      fetchJson(url, options = {}) {
        return request(url, options);
      },
      postJson(url, body) {
        return request(url, createJsonRequestOptions("POST", body));
      },
      patchJson(url, body) {
        return request(url, createJsonRequestOptions("PATCH", body));
      },
      putJson(url, body) {
        return request(url, createJsonRequestOptions("PUT", body));
      },
      loadOverview() {
        return request("/api/overview");
      },
      loadTaskDetail(taskId) {
        return request(`/api/tasks/${encodeURIComponent(taskId)}`);
      },
      loadTaskExecution(taskId) {
        return request(`/api/tasks/${encodeURIComponent(taskId)}/execution`);
      },
      loadTaskExecutionLog(taskId, stream, maxChars = 6000) {
        return request(buildTaskExecutionLogUrl(taskId, stream, maxChars));
      },
      loadRunLog(taskId, runId, stream) {
        return request(buildRunLogUrl(taskId, runId, stream));
      },
    };
  }

  function createJsonRequester(fetchImpl) {
    return async function requestJson(url, options = {}) {
      if (typeof fetchImpl !== "function") {
        throw new Error("Fetch is unavailable for the dashboard API client.");
      }

      const response = await fetchImpl(url, options);
      const isJson = (response.headers.get("content-type") || "").includes("application/json");
      const payload = isJson ? await response.json() : null;

      if (!response.ok) {
        throw new Error((payload && payload.error) || `Failed to load ${url}`);
      }

      return payload;
    };
  }

  function createJsonRequestOptions(method, body) {
    return {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    };
  }

  function buildTaskExecutionLogUrl(taskId, stream, maxChars = 6000) {
    const params = new URLSearchParams();
    params.set("maxChars", String(maxChars));
    return `/api/tasks/${encodeURIComponent(taskId)}/execution/logs/${encodeURIComponent(stream)}?${params.toString()}`;
  }

  function buildRunLogUrl(taskId, runId, stream) {
    return `/api/tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/logs/${encodeURIComponent(stream)}`;
  }

  return {
    buildRunLogUrl,
    buildTaskExecutionLogUrl,
    createDashboardApiClient,
    createJsonRequestOptions,
  };
});
