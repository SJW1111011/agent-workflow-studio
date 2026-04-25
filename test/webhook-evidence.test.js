const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const { startDashboardServer } = require("../src/server");
const { getTaskDetail } = require("../src/lib/task-service");
const { buildTaskTrustSummary } = require("../src/lib/trust-summary");
const {
  listCiEvidenceRecords,
  recordWebhookEvidence,
  validateWebhookSignature,
} = require("../src/lib/webhook-evidence");
const { createTaskWorkspace, readJsonFile } = require("./test-helpers");

function calculateSignature(rawBody, secret) {
  return `sha256=${crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestBody =
      typeof options.rawBody === "string"
        ? options.rawBody
        : options.body === undefined
          ? null
          : JSON.stringify(options.body);
    const headers = {
      ...(options.headers || {}),
    };

    if (requestBody !== null && headers["Content-Type"] === undefined) {
      headers["Content-Type"] = "application/json";
    }

    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers,
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          let json = null;
          try {
            json = body ? JSON.parse(body) : null;
          } catch (error) {
            json = null;
          }

          resolve({
            body,
            headers: response.headers,
            json,
            statusCode: response.statusCode,
          });
        });
      }
    );

    req.on("error", reject);
    if (requestBody !== null) {
      req.write(requestBody);
    }
    req.end();
  });
}

async function startServer(workspaceRoot) {
  const port = await getFreePort();
  const server = startDashboardServer(workspaceRoot, { port });

  for (let index = 0; index < 40; index += 1) {
    try {
      const response = await request(`http://127.0.0.1:${port}/api/health`);
      if (response.statusCode === 200 && response.json && response.json.ok === true) {
        return {
          port,
          server,
        };
      }
    } catch (error) {
      // Retry until the local server is ready.
    }

    await delay(50);
  }

  await stopServer(server);
  throw new Error("Timed out waiting for local server to become ready.");
}

function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function withWebhookSecret(secret, callback) {
  const previous = process.env.WORKFLOW_WEBHOOK_SECRET;
  if (secret === undefined) {
    delete process.env.WORKFLOW_WEBHOOK_SECRET;
  } else {
    process.env.WORKFLOW_WEBHOOK_SECRET = secret;
  }

  try {
    return await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.WORKFLOW_WEBHOOK_SECRET;
    } else {
      process.env.WORKFLOW_WEBHOOK_SECRET = previous;
    }
  }
}

const tests = [
  {
    name: "webhook signature validation uses HMAC-SHA256 and rejects mismatches",
    run() {
      const rawBody = JSON.stringify({ taskId: "T-001", status: "passed" });
      const signature = calculateSignature(rawBody, "shared-secret");

      assert.equal(validateWebhookSignature(rawBody, signature, "shared-secret"), true);
      assert.equal(validateWebhookSignature(rawBody, "", ""), true);
      assert.throws(
        () => validateWebhookSignature(rawBody, "sha256=bad", "shared-secret"),
        /Missing or invalid workflow signature/,
      );
      assert.throws(
        () => validateWebhookSignature(rawBody, calculateSignature(rawBody, "wrong-secret"), "shared-secret"),
        /Workflow signature mismatch/,
      );
    },
  },
  {
    name: "recordWebhookEvidence writes append-only CI records and updates trust adjustments",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("webhook-evidence-record");
      const secret = "unit-secret";
      const passedPayload = {
        taskId,
        source: "github-actions",
        status: "success",
        checks: ["unit tests: passed", { label: "coverage", status: "passed", details: "87%" }],
        metadata: {
          branch: "main",
          runId: "12345",
          sha: "abc123",
        },
      };
      const passedRawBody = JSON.stringify(passedPayload);
      const passedResult = recordWebhookEvidence(workspaceRoot, passedPayload, {
        createdAt: "2026-04-25T01:00:00.000Z",
        id: "ci-evidence-passed",
        rawBody: passedRawBody,
        secret,
        signatureHeader: calculateSignature(passedRawBody, secret),
      });

      assert.equal(passedResult.evidence.status, "passed");
      assert.equal(passedResult.signatureVerified, true);
      assert.ok(fs.existsSync(path.join(files.runs, `${passedResult.evidence.id}.json`)));

      const persistedPassed = readJsonFile(path.join(files.runs, `${passedResult.evidence.id}.json`));
      assert.equal(persistedPassed.type, "ci-evidence");
      assert.deepEqual(persistedPassed.checks, ["unit tests: passed", "[passed] coverage - 87%"]);

      const detailAfterPassed = getTaskDetail(workspaceRoot, taskId);
      assert.equal(detailAfterPassed.ciEvidenceRecords.length, 1);
      assert.equal(buildTaskTrustSummary(detailAfterPassed).ciAdjustment, 5);
      assert.equal(buildTaskTrustSummary(detailAfterPassed).ciStatus, "passed");

      const failedPayload = {
        ...passedPayload,
        status: "failure",
      };
      const failedRawBody = JSON.stringify(failedPayload);
      recordWebhookEvidence(workspaceRoot, failedPayload, {
        createdAt: "2026-04-25T02:00:00.000Z",
        id: "ci-evidence-failed",
        rawBody: failedRawBody,
        secret,
        signatureHeader: calculateSignature(failedRawBody, secret),
      });

      const records = listCiEvidenceRecords(workspaceRoot, taskId);
      assert.equal(records.length, 2);
      assert.deepEqual(records.map((record) => record.status), ["passed", "failed"]);

      const trustAfterFailed = buildTaskTrustSummary(getTaskDetail(workspaceRoot, taskId));
      assert.equal(trustAfterFailed.ciAdjustment, -10);
      assert.equal(trustAfterFailed.ciStatus, "failed");
      assert.equal(trustAfterFailed.trustScore, 0);
    },
  },
  {
    name: "POST /api/webhook/evidence records signed payloads and rejects bad signatures",
    async run() {
      await withWebhookSecret("server-secret", async () => {
        const { workspaceRoot, taskId } = createTaskWorkspace("webhook-evidence-server");
        const server = await startServer(workspaceRoot);

        try {
          const payload = {
            taskId,
            source: "github-actions",
            status: "passed",
            checks: ["npm test: passed"],
            metadata: {
              branch: "main",
              runId: "98765",
              sha: "def456",
            },
          };
          const rawBody = JSON.stringify(payload);
          const signed = await request(`http://127.0.0.1:${server.port}/api/webhook/evidence`, {
            method: "POST",
            rawBody,
            headers: {
              "Content-Type": "application/json",
              "X-Workflow-Signature": calculateSignature(rawBody, "server-secret"),
            },
          });

          assert.equal(signed.statusCode, 201);
          assert.equal(signed.json.ok, true);
          assert.match(signed.json.evidenceId, /^ci-evidence-/);
          assert.equal(signed.json.taskId, taskId);

          const detail = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}`);
          assert.equal(detail.statusCode, 200);
          assert.equal(detail.json.ciEvidenceRecords.length, 1);
          assert.equal(detail.json.ciEvidenceRecords[0].source, "github-actions");

          const rejected = await request(`http://127.0.0.1:${server.port}/api/webhook/evidence`, {
            method: "POST",
            rawBody,
            headers: {
              "Content-Type": "application/json",
              "X-Workflow-Signature": calculateSignature(rawBody, "wrong-secret"),
            },
          });
          assert.equal(rejected.statusCode, 401);
          assert.equal(rejected.json.code, "webhook_signature_invalid");

          const afterRejected = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}`);
          assert.equal(afterRejected.json.ciEvidenceRecords.length, 1);

          const malformedBody = "{";
          const malformed = await request(`http://127.0.0.1:${server.port}/api/webhook/evidence`, {
            method: "POST",
            rawBody: malformedBody,
            headers: {
              "Content-Type": "application/json",
              "X-Workflow-Signature": calculateSignature(malformedBody, "server-secret"),
            },
          });
          assert.equal(malformed.statusCode, 400);
          assert.equal(malformed.json.error, "Invalid JSON body.");
        } finally {
          await stopServer(server.server);
        }
      });
    },
  },
];

const suite = {
  name: "webhook-evidence",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
