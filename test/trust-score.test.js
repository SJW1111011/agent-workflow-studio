const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  calculateTrustScore: calculateServerTrustScore,
} = require("../src/lib/trust-summary");

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
          ciStatus: "passed",
          collectorCount: 2,
          coverage: 75,
          freshness: "recorded",
          signal: "partial",
        }),
        67,
      );
      assert.equal(
        calculateTrustScore({
          ciStatus: "failed",
          collectorCount: 2,
          coverage: 75,
          freshness: "recorded",
          signal: "partial",
        }),
        52,
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
      assert.equal(
        calculateTrustScore({
          collectorCount: 2,
          coverage: 75,
          freshness: "recorded",
          reviewStatus: "approved",
          signal: "partial",
        }),
        72,
      );
      assert.equal(
        calculateTrustScore({
          collectorCount: 2,
          coverage: 75,
          freshness: "recorded",
          reviewStatus: "rejected",
          signal: "partial",
        }),
        42,
      );
      assert.equal(
        calculateTrustScore({
          collectorCount: 4,
          coverage: 100,
          freshness: "current",
          reviewStatus: "approved",
          signal: "verified",
        }),
        100,
      );
      assert.equal(
        calculateTrustScore({
          collectorCount: 0,
          coverage: 0,
          freshness: "stale",
          reviewStatus: "rejected",
          signal: "none",
        }),
        0,
      );
      assert.equal(
        calculateServerTrustScore({
          ciStatus: "passed",
          collectorCount: 2,
          coverage: 75,
          freshness: "recorded",
          reviewStatus: "approved",
          signal: "partial",
        }),
        77,
      );
    },
  },
  {
    name: "buildTaskTrustSnapshot derives signal, freshness, collectors, and score from task evidence",
    async run() {
      const { buildTaskTrustSnapshot } = await loadTrustScoreModule();

      const snapshot = buildTaskTrustSnapshot({
        activityRecords: [{ createdAt: "2026-04-22T01:02:00.000Z" }],
        ciEvidenceRecords: [
          {
            createdAt: "2026-04-22T01:06:00.000Z",
            status: "passed",
          },
        ],
        meta: {
          reviewStatus: "approved",
        },
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
      assert.equal(snapshot.reviewStatus, "approved");
      assert.equal(snapshot.collectorCount, 4);
      assert.equal(snapshot.ciAdjustment, 5);
      assert.equal(snapshot.ciEvidenceCount, 1);
      assert.equal(snapshot.ciStatus, "passed");
      assert.equal(snapshot.trustScore, 95);
      assert.equal(snapshot.lastEvidenceAt, "2026-04-22T01:06:00.000Z");
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
