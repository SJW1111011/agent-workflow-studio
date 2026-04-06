const suites = [
  require("../test/proof-anchors.test.js"),
  require("../test/repository-snapshot.test.js"),
  require("../test/verification-gates.test.js"),
  require("../test/task-documents.test.js"),
];

let passedCount = 0;
let failedCount = 0;

suites.forEach((suite) => {
  (Array.isArray(suite.tests) ? suite.tests : []).forEach((testCase) => {
    const name = `${suite.name}: ${testCase.name}`;

    try {
      testCase.run();
      passedCount += 1;
      console.log(`ok - ${name}`);
    } catch (error) {
      failedCount += 1;
      console.error(`not ok - ${name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  });
});

if (failedCount > 0) {
  console.error(`Unit test failed. ${passedCount} passed, ${failedCount} failed.`);
  process.exitCode = 1;
} else {
  console.log(`Unit test passed. ${passedCount} passed.`);
}
