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
      quickCreateTask(body) {
        return request("/api/quick", createJsonRequestOptions("POST", body));
      },
      loadOverview() {
        return request("/api/overview");
      },
      loadTrustSummary() {
        return request("/api/trust-summary");
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
        const error = new Error((payload && payload.error) || `Failed to load ${url}`);
        if (payload && typeof payload.code === "string" && payload.code.trim()) {
          error.code = payload.code.trim();
        }
        if (payload && typeof payload.failureCategory === "string" && payload.failureCategory.trim()) {
          error.failureCategory = payload.failureCategory.trim();
        }
        if (payload && Array.isArray(payload.blockingIssues) && payload.blockingIssues.length > 0) {
          error.blockingIssues = payload.blockingIssues;
        }
        if (payload && Array.isArray(payload.advisories) && payload.advisories.length > 0) {
          error.advisories = payload.advisories;
        }
        throw error;
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
