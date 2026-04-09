const suites = [
  require("../test/adapters.test.js"),
  require("../test/cli.test.js"),
  require("../test/http-errors.test.js"),
  require("../test/memory-bootstrap.test.js"),
  require("../test/memory-validator.test.js"),
  require("../test/overview.test.js"),
  require("../test/quick-task.test.js"),
  require("../test/run-executor.test.js"),
  require("../test/server-api.test.js"),
  require("../test/dashboard-document-helpers.test.js"),
  require("../test/dashboard-api-client-helpers.test.js"),
  require("../test/dashboard-form-event-helpers.test.js"),
  require("../test/dashboard-form-state-helpers.test.js"),
  require("../test/dashboard-log-panel-helpers.test.js"),
  require("../test/dashboard-orchestration-state-helpers.test.js"),
  require("../test/dashboard-overview-render-helpers.test.js"),
  require("../test/dashboard-task-list-render-helpers.test.js"),
  require("../test/dashboard-task-detail-helpers.test.js"),
  require("../test/proof-anchors.test.js"),
  require("../test/repository-snapshot.test.js"),
  require("../test/verification-gates.test.js"),
  require("../test/task-documents.test.js"),
];

let passedCount = 0;
let failedCount = 0;

async function main() {
  for (const suite of suites) {
    for (const testCase of Array.isArray(suite.tests) ? suite.tests : []) {
      const name = `${suite.name}: ${testCase.name}`;

      try {
        await testCase.run();
        passedCount += 1;
        console.log(`ok - ${name}`);
      } catch (error) {
        failedCount += 1;
        console.error(`not ok - ${name}`);
        console.error(error && error.stack ? error.stack : error);
      }
    }
  }

  if (failedCount > 0) {
    console.error(`Unit test failed. ${passedCount} passed, ${failedCount} failed.`);
    process.exitCode = 1;
  } else {
    console.log(`Unit test passed. ${passedCount} passed.`);
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
