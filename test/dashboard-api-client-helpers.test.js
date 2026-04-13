const assert = require("node:assert/strict");

const {
  buildRunLogUrl,
  buildTaskExecutionLogUrl,
  createDashboardApiClient,
  createJsonRequestOptions,
} = require("../dashboard/api-client-helpers.js");

const tests = [
  {
    name: "request option and url helpers preserve dashboard api contracts",
    run() {
      const options = createJsonRequestOptions("PATCH", { title: "Updated" });

      assert.deepEqual(options, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Updated" }),
      });
      assert.equal(
        buildTaskExecutionLogUrl("T 001", "stdout", 4096),
        "/api/tasks/T%20001/execution/logs/stdout?maxChars=4096"
      );
      assert.equal(
        buildRunLogUrl("T-001", "run 1", "stderr"),
        "/api/tasks/T-001/runs/run%201/logs/stderr"
      );
    },
  },
  {
    name: "dashboard api client builds expected urls and json mutation requests",
    async run() {
      const calls = [];
      const client = createDashboardApiClient(async (url, options = {}) => {
        calls.push({ url, options });
        return {
          ok: true,
          headers: {
            get() {
              return "application/json";
            },
          },
          async json() {
            return { ok: true, url };
          },
        };
      });

      await client.postJson("/api/tasks", { taskId: "T-001" });
      await client.quickCreateTask({ title: "Ship onboarding" });
      await client.patchJson("/api/tasks/T-001", { status: "done" });
      await client.putJson("/api/tasks/T-001/documents/task.md", { content: "# updated" });
      await client.loadOverview();
      await client.loadTaskDetail("T 002");
      await client.loadTaskExecution("T 002");
      await client.loadTaskExecutionLog("T 002", "stdout", 2048);
      await client.loadRunLog("T 002", "run 7", "stderr");

      assert.equal(calls[0].url, "/api/tasks");
      assert.equal(calls[0].options.method, "POST");
      assert.equal(calls[1].url, "/api/quick");
      assert.equal(calls[1].options.method, "POST");
      assert.equal(calls[2].options.method, "PATCH");
      assert.equal(calls[3].options.method, "PUT");
      assert.equal(calls[4].url, "/api/overview");
      assert.equal(calls[5].url, "/api/tasks/T%20002");
      assert.equal(calls[6].url, "/api/tasks/T%20002/execution");
      assert.equal(calls[7].url, "/api/tasks/T%20002/execution/logs/stdout?maxChars=2048");
      assert.equal(calls[8].url, "/api/tasks/T%20002/runs/run%207/logs/stderr");
    },
  },
  {
    name: "dashboard api client surfaces structured api errors",
    async run() {
      const client = createDashboardApiClient(async () => ({
        ok: false,
        headers: {
          get() {
            return "application/json";
          },
        },
        async json() {
          return {
            error: "Task does not exist.",
            code: "task_not_found",
            failureCategory: "task-missing",
            blockingIssues: [{ field: "taskId", message: "Task T-999 does not exist yet." }],
            advisories: [{ code: "note", message: "Check the current workspace root." }],
          };
        },
      }));

      let error = null;
      try {
        await client.loadTaskDetail("T-999");
      } catch (caught) {
        error = caught;
      }

      assert.ok(error);
      assert.match(error.message, /Task does not exist\./);
      assert.equal(error.code, "task_not_found");
      assert.equal(error.failureCategory, "task-missing");
      assert.ok(Array.isArray(error.blockingIssues));
      assert.equal(error.blockingIssues[0].field, "taskId");
      assert.ok(Array.isArray(error.advisories));
      assert.equal(error.advisories[0].message, "Check the current workspace root.");
    },
  },
];

const suite = {
  name: "dashboard-api-client-helpers",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
