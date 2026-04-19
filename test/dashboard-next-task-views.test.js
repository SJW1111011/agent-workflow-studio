const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let taskViewsModulePromise;

function loadTaskViewsModule() {
  if (!taskViewsModulePromise) {
    taskViewsModulePromise = import(
      pathToFileURL(
        path.join(
          __dirname,
          "..",
          "dashboard-next",
          "src",
          "utils",
          "taskViews.js",
        ),
      ).href
    );
  }

  return taskViewsModulePromise;
}

const tests = [
  {
    name: "task view helpers normalize selector values and group tasks into kanban columns",
    async run() {
      const { groupTasksByStatus, normalizeTaskStatus, normalizeTaskView } =
        await loadTaskViewsModule();

      const columns = groupTasksByStatus([
        {
          createdAt: "2026-04-01T09:00:00.000Z",
          id: "T-001",
          status: "todo",
        },
        {
          createdAt: "2026-04-03T09:00:00.000Z",
          id: "T-002",
          status: "blocked",
        },
        {
          createdAt: "2026-04-04T09:00:00.000Z",
          id: "T-003",
          status: "done",
        },
        {
          createdAt: "2026-04-02T09:00:00.000Z",
          id: "T-004",
          status: "queued",
        },
      ]);

      assert.equal(normalizeTaskView("TIMELINE"), "timeline");
      assert.equal(normalizeTaskView("spreadsheet"), "list");
      assert.equal(normalizeTaskStatus("blocked"), "in_progress");
      assert.equal(normalizeTaskStatus("queued"), "todo");
      assert.deepEqual(
        columns.map((column) => [column.id, column.count]),
        [
          ["todo", 2],
          ["in_progress", 1],
          ["done", 1],
        ],
      );
      assert.deepEqual(
        columns.find((column) => column.id === "todo").tasks.map((task) => task.id),
        ["T-001", "T-004"],
      );
    },
  },
  {
    name: "task view helpers sort tasks, group runs, and position timeline markers chronologically",
    async run() {
      const {
        buildTimelineAxis,
        buildTimelineBounds,
        getTimelinePosition,
        groupRunsByTaskId,
        sortTasksByCreatedAt,
      } = await loadTaskViewsModule();

      const tasks = [
        {
          createdAt: "2026-04-05T00:00:00.000Z",
          id: "T-002",
        },
        {
          createdAt: "2026-04-01T00:00:00.000Z",
          id: "T-001",
        },
      ];
      const runs = [
        {
          createdAt: "2026-04-03T00:00:00.000Z",
          id: "run-1",
          taskId: "T-001",
        },
        {
          createdAt: "2026-04-07T00:00:00.000Z",
          id: "run-2",
          taskId: "T-002",
        },
      ];

      const sortedTasks = sortTasksByCreatedAt(tasks);
      const groupedRuns = groupRunsByTaskId(runs);
      const bounds = buildTimelineBounds(tasks, runs);
      const axis = buildTimelineAxis(bounds, 4);
      const createdPosition = getTimelinePosition(
        "2026-04-01T00:00:00.000Z",
        bounds,
      );
      const firstRunPosition = getTimelinePosition(
        "2026-04-03T00:00:00.000Z",
        bounds,
      );
      const secondRunPosition = getTimelinePosition(
        "2026-04-07T00:00:00.000Z",
        bounds,
      );

      assert.deepEqual(sortedTasks.map((task) => task.id), ["T-001", "T-002"]);
      assert.deepEqual(
        groupedRuns.get("T-001").map((run) => run.id),
        ["run-1"],
      );
      assert.deepEqual(
        groupedRuns.get("T-002").map((run) => run.id),
        ["run-2"],
      );
      assert.equal(axis.length, 4);
      assert.equal(axis[0].position, 0);
      assert.equal(axis[3].position, 100);
      assert.ok(createdPosition < firstRunPosition);
      assert.ok(firstRunPosition < secondRunPosition);
    },
  },
];

const suite = {
  name: "dashboard-next-task-views",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
