const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let trustScoreModulePromise;

function loadTrustScoreModule() {
  if (!trustScoreModulePromise) {
    trustScoreModulePromise = import(
      pathToFileURL(
        path.join(
          __dirname,
          "..",
          "dashboard-next",
          "src",
          "utils",
          "trustScore.js",
        ),
      ).href
    );
  }

  return trustScoreModulePromise;
}

const tests = [
  {
    name: "calculateTrustScore applies the documented weighted formula deterministically",
    async run() {
      const { calculateTrustScore } = await loadTrustScoreModule();

      assert.equal(
        calculateTrustScore({
          collectorCount: 2,
          coverage: 75,
          freshness: "recorded",
          signal: "partial",
        }),
        62,
      );
      assert.equal(
        calculateTrustScore({
          collectorCount: 4,
          coverage: 100,
          freshness: "current",
          signal: "verified",
        }),
        100,
      );
    },
  },
  {
    name: "buildTaskTrustSnapshot derives signal, freshness, collectors, and score from task evidence",
    async run() {
      const { buildTaskTrustSnapshot } = await loadTrustScoreModule();

      const snapshot = buildTaskTrustSnapshot({
        activityRecords: [{ createdAt: "2026-04-22T01:02:00.000Z" }],
        runs: [
          {
            collectorResults: [{ collectorId: "npm-test" }],
            createdAt: "2026-04-22T01:00:00.000Z",
            evidence: {
              collectors: [{ collectorId: "smoke" }],
            },
          },
        ],
        verificationGate: {
          coveragePercent: 80,
          evidence: {
            latestEvidenceAt: "2026-04-22T01:05:00.000Z",
          },
          proofCoverage: {
            currentVerifiedEvidenceCount: 1,
            items: [
              {
                recordedAt: "2026-04-22T01:01:00.000Z",
                sourceType: "manual",
                verified: true,
              },
              {
                recordedAt: "2026-04-22T01:03:00.000Z",
                sourceType: "run",
                verified: true,
              },
            ],
          },
        },
        verificationText: [
          "# T-001 Verification",
          "",
          "## Draft checks",
          "",
          "- manual: Inspect the newest scoped diff",
        ].join("\n"),
      });

      assert.equal(snapshot.coverage, 80);
      assert.equal(snapshot.signal, "partial");
      assert.equal(snapshot.freshness, "current");
      assert.equal(snapshot.collectorCount, 4);
      assert.equal(snapshot.trustScore, 80);
      assert.equal(snapshot.lastEvidenceAt, "2026-04-22T01:05:00.000Z");
    },
  },
];

const suite = {
  name: "trust-score",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
