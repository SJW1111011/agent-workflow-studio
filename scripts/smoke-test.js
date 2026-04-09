const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const {
  buildPendingProofCheckLines,
  describeExecutionPresentation,
  describeRunPresentation,
  describeVerificationProofSignals,
  buildVerificationPlannedCheckDraft,
  buildVerificationProofDraft,
  extractVerificationPlannedChecks,
  formatVerificationPlannedCheck,
  extractVerificationPlannedManualChecks,
  extractVerificationProofPaths,
  filterTasksByExecutorOutcome,
  getEditableDocumentConfig,
  getPendingProofPaths,
  hasRunDraftVerificationContent,
  matchesExecutorOutcomeFilter,
  mergeVerificationFromRunDraft,
  mergeVerificationProofPlanDraft,
  mergeVerificationPlannedCheckDraft,
  mergeVerificationProofDraft,
  mergeProofCheckDraft,
  mergeProofPathDraft,
  normalizeExecutorOutcomeFilter,
  parseRunVerificationDraft,
  parseRunEvidenceDraft,
  resolveExecutionLogSource,
  summarizeExecutorOutcomeFilter,
} = require("../dashboard/app.js");

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const cliPath = path.join(projectRoot, "src", "cli.js");
  const serverPath = path.join(projectRoot, "src", "server.js");
  const tempRoot = path.join(projectRoot, "tmp", "smoke-workspace");

  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(tempRoot, "docs"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, "README.md"),
    "# Smoke Workspace\n\nThis repo exists to validate Agent Workflow Studio.\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "smoke-workspace",
        version: "0.0.1",
        scripts: {
          test: "node -e \"console.log('ok')\"",
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempRoot, "docs", "notes.md"),
    "# Notes\n\nThe scanner should discover this file.\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempRoot, "fake-runner.js"),
    `const fs = require("fs");
const path = require("path");

async function main() {
  const promptPath = process.argv[2];
  const runRequestPath = process.argv[3];
  const extras = process.argv.slice(4);

  if (!promptPath || !runRequestPath) {
    console.error("missing args");
    process.exit(2);
  }

  let sleepMs = 0;
  for (let index = 0; index < extras.length; index += 1) {
    if (extras[index] === "--sleep-ms") {
      sleepMs = Number(extras[index + 1] || 0);
      index += 1;
    }
  }

  const prompt = fs.readFileSync(promptPath, "utf8");
  const runRequest = JSON.parse(fs.readFileSync(runRequestPath, "utf8"));
  const markerPath = path.join(process.cwd(), \`\${runRequest.taskId}.marker.txt\`);

  fs.writeFileSync(markerPath, prompt.includes(\`# \${runRequest.taskId} Prompt\`) ? "executor-ok\\n" : "executor-bad\\n", "utf8");
  console.log("stdout", runRequest.taskId, runRequest.adapterId);
  console.error("stderr", runRequest.taskId, runRequest.adapterId);

  if (sleepMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
`,
    "utf8"
  );

  const parsedDashboardEvidence = parseRunEvidenceDraft({
    status: "passed",
    scopeProofPaths: "README.md\nsrc/server.js",
    verificationChecks: "Reviewed README diff\npassed | npm run smoke | smoke workspace ok | .agent-workflow/tasks/T-001/checkpoint.md",
    verificationArtifacts: ".agent-workflow/tasks/T-001/checkpoint.md\n.agent-workflow/tasks/T-001/verification.md",
  });
  if (
    !Array.isArray(parsedDashboardEvidence.scopeProofPaths) ||
    parsedDashboardEvidence.scopeProofPaths.length !== 2 ||
    !Array.isArray(parsedDashboardEvidence.verificationChecks) ||
    parsedDashboardEvidence.verificationChecks.length !== 2 ||
    parsedDashboardEvidence.verificationChecks[0].status !== "passed" ||
    parsedDashboardEvidence.verificationChecks[1].label !== "npm run smoke" ||
    !Array.isArray(parsedDashboardEvidence.verificationChecks[1].artifacts) ||
    !parsedDashboardEvidence.verificationChecks[1].artifacts.includes(".agent-workflow/tasks/T-001/checkpoint.md") ||
    !Array.isArray(parsedDashboardEvidence.verificationArtifacts) ||
    !parsedDashboardEvidence.verificationArtifacts.includes(".agent-workflow/tasks/T-001/verification.md")
  ) {
    throw new Error("Dashboard structured proof parser did not normalize run evidence inputs.");
  }
  const taskDocConfig = getEditableDocumentConfig("task.md");
  const verificationDocConfig = getEditableDocumentConfig("verification.md");
  if (
    !Array.isArray(taskDocConfig.managedSections) ||
    !taskDocConfig.managedSections.includes("Heading from task id/title") ||
    !Array.isArray(taskDocConfig.freeSections) ||
    !taskDocConfig.freeSections.includes("Scope") ||
    !Array.isArray(verificationDocConfig.managedSections) ||
    !verificationDocConfig.managedSections.includes("Heading from task id") ||
    !verificationDocConfig.freeSections.includes("Proof links")
  ) {
    throw new Error("Dashboard editor guidance config did not expose managed and free-edit sections.");
  }
  const mergedPendingPaths = mergeProofPathDraft(
    "README.md\nsrc/server.js",
    {
      verificationGate: {
        relevantChangedFiles: [{ path: "src/server.js" }, { path: "docs/notes.md" }],
      },
    }
  );
  const pendingProofPaths = getPendingProofPaths({
    verificationGate: {
      relevantChangedFiles: [{ path: "docs/notes.md" }, { path: "README.md" }],
    },
  });
  const draftedPendingChecks = buildPendingProofCheckLines({
    verificationGate: {
      relevantChangedFiles: [{ path: "docs/notes.md" }, { path: "README.md" }],
    },
  });
  const mergedPendingChecks = mergeProofCheckDraft(
    "Review README.md diff\npassed | npm run smoke | smoke workspace ok",
    {
      verificationGate: {
        relevantChangedFiles: [{ path: "docs/notes.md" }, { path: "README.md" }],
      },
    },
    "passed"
  );
  const verificationPlannedCheckDraft = buildVerificationPlannedCheckDraft(
    {
      verificationGate: {
        relevantChangedFiles: [{ path: "docs/notes.md" }, { path: "README.md" }],
      },
    },
    "# T-001 Verification\n\n## Planned checks\n\n- automated:\n- manual: Review README.md diff"
  );
  const verificationProofDraft = buildVerificationProofDraft(
    {
      verificationGate: {
        relevantChangedFiles: [{ path: "docs/notes.md" }, { path: "README.md" }],
      },
    },
    "# T-001 Verification\n\n## Proof links\n\n### Proof 1\n\n- Files: README.md\n- Check:\n- Result:\n- Artifact:"
  );
  const mergedVerificationProofDraft = mergeVerificationProofDraft(
    "# T-001 Verification\n\n## Blocking gaps\n\n- none",
    {
      verificationGate: {
        relevantChangedFiles: [{ path: "docs/notes.md" }],
      },
    }
  );
  const mergedVerificationPlannedChecks = mergeVerificationPlannedCheckDraft(
    "# T-001 Verification\n\n## Proof links\n\n### Proof 1\n\n- Files: README.md\n- Check:\n- Result:\n- Artifact:",
    {
      verificationGate: {
        relevantChangedFiles: [{ path: "docs/notes.md" }],
      },
    }
  );
  const mergedVerificationProofPlan = mergeVerificationProofPlanDraft(
    "# T-001 Verification\n\n## Planned checks\n\n- automated:\n- manual: Review README.md diff",
    {
      verificationGate: {
        relevantChangedFiles: [{ path: "docs/notes.md" }, { path: "README.md" }],
      },
    }
  );
  const extractedVerificationPlannedChecks = Array.from(
    extractVerificationPlannedManualChecks(
      "# T-001 Verification\n\n## Planned checks\n\n- automated:\n- manual: Review docs/notes.md diff\n- manual: Review README.md diff"
    )
  );
  const parsedRunVerificationDraft = parseRunVerificationDraft({
    status: "passed",
    scopeProofPaths: "docs/notes.md\nREADME.md",
    verificationChecks: "Review docs/notes.md diff\npassed | npm run smoke | smoke workspace ok",
  });
  const mergedVerificationFromRunDraft = mergeVerificationFromRunDraft(
    "# T-001 Verification\n\n## Blocking gaps\n\n- none",
    {
      status: "passed",
      scopeProofPaths: "docs/notes.md",
      verificationChecks: "Review docs/notes.md diff\npassed | npm run smoke | smoke workspace ok",
    }
  );
  const extractedVerificationProofPaths = Array.from(
    extractVerificationProofPaths(
      "# T-001 Verification\n\n## Proof links\n\n### Proof 1\n\n- Files: docs/notes.md, README.md\n- Check:\n- Result:\n- Artifact:"
    )
  );
  const filteredExecutorTasks = filterTasksByExecutorOutcome(
    [
      { id: "T-001", latestExecutorOutcome: "passed" },
      { id: "T-002", latestExecutorOutcome: "cancelled" },
      { id: "T-003" },
    ],
    "cancelled"
  );
  const runningExecutionLogSource = resolveExecutionLogSource(
    "T-001",
    {
      taskId: "T-001",
      status: "running",
      runId: "run-1",
      stdoutFile: ".agent-workflow/tasks/T-001/runs/run-1.stdout.log",
    },
    "stdout"
  );
  const completedExecutionLogSource = resolveExecutionLogSource(
    "T-001",
    {
      taskId: "T-001",
      status: "completed",
      runId: "run-1",
      stdoutFile: ".agent-workflow/tasks/T-001/runs/run-1.stdout.log",
    },
    "stdout"
  );
  const cancelledExecutionPresentation = describeExecutionPresentation({
    status: "completed",
    outcome: "cancelled",
    summary: "Executor interrupted by dashboard-cancel.",
  });
  const timedOutExecutionPresentation = describeExecutionPresentation({
    status: "completed",
    outcome: "timed-out",
    summary: "Executor timed out after 50 ms.",
  });
  const preflightFailedExecutionPresentation = describeExecutionPresentation({
    status: "preflight-failed",
    error: "Dashboard does not support stdioMode inherit.",
  });
  const cancelledRunPresentation = describeRunPresentation({
    status: "failed",
    interrupted: true,
    interruptionSignal: "dashboard-cancel",
  });
  const failedRunPresentation = describeRunPresentation({
    status: "failed",
    summary: "Executor failed with exit code 1.",
  });
  const plannedVerificationChecks = extractVerificationPlannedChecks(
    "# T-001 Verification\n\n## Planned checks\n\n- automated: npm run smoke\n- manual: Review docs/notes.md diff"
  );
  const draftVerificationSignals = describeVerificationProofSignals(
    {
      proofCoverage: {
        items: [
          {
            sourceType: "manual",
            sourceLabel: "verification.md#proof-1",
            recordedAt: "2026-04-05T00:00:00.000Z",
            paths: ["docs/notes.md"],
            checks: [],
            artifacts: [],
            strong: false,
          },
        ],
      },
    },
    "# T-001 Verification\n\n## Planned checks\n\n- manual: Review docs/notes.md diff"
  );
  const strongVerificationSignals = describeVerificationProofSignals(
    {
      proofCoverage: {
        items: [
          {
            sourceType: "run",
            sourceLabel: "run-1",
            recordedAt: "2026-04-05T00:00:00.000Z",
            paths: ["docs/notes.md"],
            checks: ["[passed] Review docs/notes.md diff"],
            artifacts: [".agent-workflow/tasks/T-001/runs/run-1.stdout.log"],
            strong: true,
          },
        ],
      },
    },
    "# T-001 Verification\n\n## Planned checks\n\n- manual: Review docs/notes.md diff"
  );
  const placeholderPlannedVerificationChecks = extractVerificationPlannedChecks(
    "# T-001 Verification\n\n## Planned checks\n\n- automated:\n- manual:"
  );
  if (
    mergedPendingPaths !== "README.md\nsrc/server.js\ndocs/notes.md" ||
    pendingProofPaths.join(",") !== "docs/notes.md,README.md" ||
    draftedPendingChecks.join(",") !== "Review docs/notes.md diff,Review README.md diff" ||
    mergedPendingChecks !== "Review README.md diff\npassed | npm run smoke | smoke workspace ok\nReview docs/notes.md diff" ||
    verificationPlannedCheckDraft !== "- manual: Review docs/notes.md diff" ||
    !verificationProofDraft.includes("### Proof 2") ||
    !verificationProofDraft.includes("- Files: docs/notes.md") ||
    !mergedVerificationProofDraft.includes("## Proof links") ||
    !mergedVerificationProofDraft.includes("- Files: docs/notes.md") ||
    !mergedVerificationPlannedChecks.includes("## Planned checks") ||
    !mergedVerificationPlannedChecks.includes("- manual: Review docs/notes.md diff") ||
    !mergedVerificationProofPlan.includes("- manual: Review docs/notes.md diff") ||
    !mergedVerificationProofPlan.includes("- Files: docs/notes.md") ||
    extractedVerificationPlannedChecks.join(",") !== "Review docs/notes.md diff,Review README.md diff" ||
    !hasRunDraftVerificationContent({
      status: "passed",
      scopeProofPaths: "docs/notes.md",
      verificationChecks: "",
    }) ||
    parsedRunVerificationDraft.scopeProofPaths.join(",") !== "docs/notes.md,README.md" ||
    parsedRunVerificationDraft.verificationChecks.length !== 2 ||
    formatVerificationPlannedCheck(parsedRunVerificationDraft.verificationChecks[1]) !== "npm run smoke - smoke workspace ok" ||
    !mergedVerificationFromRunDraft.includes("- manual: Review docs/notes.md diff") ||
    !mergedVerificationFromRunDraft.includes("- manual: npm run smoke - smoke workspace ok") ||
    !mergedVerificationFromRunDraft.includes("- Files: docs/notes.md") ||
    extractedVerificationProofPaths.join(",") !== "docs/notes.md,README.md" ||
    normalizeExecutorOutcomeFilter("Timed-Out") !== "timed-out" ||
    !matchesExecutorOutcomeFilter({ latestExecutorOutcome: "cancelled" }, "cancelled") ||
    !matchesExecutorOutcomeFilter({ latestExecutorOutcome: "" }, "none") ||
    filteredExecutorTasks.length !== 1 ||
    filteredExecutorTasks[0].id !== "T-002" ||
    !runningExecutionLogSource ||
    runningExecutionLogSource.kind !== "execution" ||
    !completedExecutionLogSource ||
    completedExecutionLogSource.kind !== "run" ||
    completedExecutionLogSource.runId !== "run-1" ||
    !cancelledExecutionPresentation ||
    cancelledExecutionPresentation.tone !== "cancelled" ||
    cancelledExecutionPresentation.headline !== "Cancelled from dashboard" ||
    !timedOutExecutionPresentation ||
    timedOutExecutionPresentation.tone !== "timed-out" ||
    timedOutExecutionPresentation.headline !== "Timed out" ||
    !preflightFailedExecutionPresentation ||
    preflightFailedExecutionPresentation.tone !== "failed" ||
    preflightFailedExecutionPresentation.headline !== "Preflight blocked" ||
    !cancelledRunPresentation ||
    cancelledRunPresentation.tone !== "cancelled" ||
    !failedRunPresentation ||
    failedRunPresentation.tone !== "failed" ||
    plannedVerificationChecks.join(",") !== "automated: npm run smoke,manual: Review docs/notes.md diff" ||
    !draftVerificationSignals ||
    draftVerificationSignals.presentation.tone !== "draft" ||
    draftVerificationSignals.weakItems.length !== 1 ||
    draftVerificationSignals.plannedChecks.length !== 1 ||
    !strongVerificationSignals ||
    strongVerificationSignals.presentation.tone !== "passed" ||
    strongVerificationSignals.strongItems.length !== 1 ||
    placeholderPlannedVerificationChecks.length !== 0 ||
    summarizeExecutorOutcomeFilter(3, 1, "cancelled") !== "Showing 1 of 3 tasks with executor outcome cancelled."
  ) {
    throw new Error("Dashboard pending proof helper utilities did not normalize the current verification gate state.");
  }

  runNode(cliPath, ["init", "--root", tempRoot]);
  runNode(cliPath, ["scan", "--root", tempRoot]);
  const memoryBootstrapOutput = runNodeOutput(cliPath, ["memory:bootstrap", "--root", tempRoot]);
  if (
    !memoryBootstrapOutput.includes("Memory bootstrap prompt ready:") ||
    !memoryBootstrapOutput.includes("memory-bootstrap.md")
  ) {
    throw new Error("memory:bootstrap did not report the expected prompt path.");
  }
  const adapterCreateOutput = runNodeOutput(cliPath, [
    "adapter:create",
    "demo-agent",
    "--name",
    "Demo Agent",
    "--runner",
    `"${process.execPath}" fake-runner.js`,
    "--argv-template",
    "{promptFile} {runRequestFile}",
    "--prompt-target",
    "claude",
    "--stdin-mode",
    "none",
    "--root",
    tempRoot,
  ]);
  if (
    !adapterCreateOutput.includes("Created adapter demo-agent") ||
    !adapterCreateOutput.includes("Prompt target: claude")
  ) {
    throw new Error("adapter:create did not report the expected adapter summary.");
  }
  const adapterListOutput = runNodeOutput(cliPath, ["adapter:list", "--root", tempRoot]);
  if (!adapterListOutput.includes("demo-agent | ready")) {
    throw new Error("adapter:list did not include the created custom adapter.");
  }
  runNode(cliPath, ["recipe:list", "--root", tempRoot]);
  const quickOutput = runNodeOutput(cliPath, [
    "quick",
    "Build scanner foundation",
    "--task-id",
    "T-001",
    "--priority",
    "P1",
    "--recipe",
    "feature",
    "--agent",
    "codex",
    "--root",
    tempRoot,
  ]);
  if (
    !quickOutput.includes("Quick task ready: T-001") ||
    !quickOutput.includes("prompt.codex.md") ||
    !quickOutput.includes("run-request.codex.json")
  ) {
    throw new Error("Quick command did not report the expected task bundle artifacts.");
  }
  runNode(cliPath, ["run:prepare", "T-001", "--adapter", "demo-agent", "--root", tempRoot]);
  runNode(cliPath, ["task:new", "T-003", "Validate executor timeout handling", "--priority", "P2", "--recipe", "feature", "--root", tempRoot]);
  runNode(cliPath, ["run:add", "T-001", "Smoke run completed.", "--status", "passed", "--agent", "codex", "--root", tempRoot]);
  runNode(cliPath, ["checkpoint", "T-001", "--root", tempRoot]);
  runNode(cliPath, ["validate", "--root", tempRoot]);

  const codexAdapterPath = path.join(tempRoot, ".agent-workflow", "adapters", "codex.json");
  const codexAdapter = JSON.parse(fs.readFileSync(codexAdapterPath, "utf8"));
  codexAdapter.commandMode = "exec";
  codexAdapter.runnerCommand = [process.execPath];
  codexAdapter.argvTemplate = ["fake-runner.js", "{promptFile}", "{runRequestFile}"];
  codexAdapter.cwdMode = "workspaceRoot";
  codexAdapter.stdioMode = "pipe";
  codexAdapter.successExitCodes = [0];
  codexAdapter.envAllowlist = [];
  fs.writeFileSync(codexAdapterPath, `${JSON.stringify(codexAdapter, null, 2)}\n`, "utf8");

  runNode(cliPath, ["run:execute", "T-001", "--agent", "codex", "--root", tempRoot]);
  codexAdapter.argvTemplate = ["fake-runner.js", "{promptFile}", "{runRequestFile}", "--sleep-ms", "250"];
  fs.writeFileSync(codexAdapterPath, `${JSON.stringify(codexAdapter, null, 2)}\n`, "utf8");
  runNodeExpectFailure(cliPath, ["run:execute", "T-003", "--agent", "codex", "--timeout-ms", "50", "--root", tempRoot]);
  runNode(cliPath, ["validate", "--root", tempRoot]);

  const staleAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const architectureMemoryPath = path.join(tempRoot, ".agent-workflow", "memory", "architecture.md");
  const t001TaskPath = path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "task.md");
  const t003ContextPath = path.join(tempRoot, ".agent-workflow", "tasks", "T-003", "context.md");
  fs.writeFileSync(architectureMemoryPath, "# Architecture Memory\n\nStable notes without template markers.\n", "utf8");
  fs.writeFileSync(
    t001TaskPath,
    `# T-001 - Build scanner foundation

## Goal

Build the first scanner slice with explicit diff-aware verification.

## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.

## Scope

- In scope:
  - files: docs/notes.md, README.md
- Out of scope:
  - path: package publishing

## Required docs

- .agent-workflow/project-profile.md

## Deliverables

- update docs/notes.md
- refresh verification evidence

## Risks

- verification can drift from the actual changed file set
`,
    "utf8"
  );
  fs.utimesSync(architectureMemoryPath, staleAt, staleAt);
  fs.utimesSync(t003ContextPath, staleAt, staleAt);

  runCommand("git", ["init"], tempRoot);
  runCommand("git", ["add", "."], tempRoot);
  runCommand(
    "git",
    ["-c", "user.name=Smoke Test", "-c", "user.email=smoke@example.com", "commit", "-m", "Initial snapshot"],
    tempRoot
  );

  fs.writeFileSync(
    path.join(tempRoot, "docs", "notes.md"),
    "# Notes\n\nThe scanner should discover this file.\n\nDiff-aware verification should detect this follow-up change.\n",
    "utf8"
  );
  runNode(cliPath, ["checkpoint", "T-001", "--root", tempRoot]);

  assertExists(path.join(tempRoot, ".agent-workflow", "adapters", "codex.json"));
  assertExists(path.join(tempRoot, ".agent-workflow", "recipes", "index.json"));
  assertExists(path.join(tempRoot, ".agent-workflow", "project-profile.json"));
  assertExists(path.join(tempRoot, ".agent-workflow", "handoffs", "memory-bootstrap.md"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "prompt.codex.md"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "prompt.demo-agent.md"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "run-request.codex.json"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "run-request.demo-agent.json"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "launch.codex.md"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "launch.demo-agent.md"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "checkpoint.md"));
  assertExists(path.join(tempRoot, "T-001.marker.txt"));

  const t001Runs = loadRunRecords(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "runs"));
  const executorRun = t001Runs.find((run) => run.source === "executor");
  if (!executorRun || executorRun.status !== "passed") {
    throw new Error("run:execute did not persist a passed executor run.");
  }
  assertExists(path.join(tempRoot, executorRun.stdoutFile));
  assertExists(path.join(tempRoot, executorRun.stderrFile));
  if (!fs.readFileSync(path.join(tempRoot, executorRun.stdoutFile), "utf8").includes("stdout T-001 codex")) {
    throw new Error("Executor stdout capture did not persist expected content.");
  }
  if (!fs.readFileSync(path.join(tempRoot, executorRun.stderrFile), "utf8").includes("stderr T-001 codex")) {
    throw new Error("Executor stderr capture did not persist expected content.");
  }
  if (!fs.readFileSync(path.join(tempRoot, "T-001.marker.txt"), "utf8").includes("executor-ok")) {
    throw new Error("Fake executor did not observe the prepared prompt.");
  }
  if (
    !fs
      .readFileSync(path.join(tempRoot, ".agent-workflow", "handoffs", "memory-bootstrap.md"), "utf8")
      .includes("Do not fake verification, production state, or business context.")
  ) {
    throw new Error("memory:bootstrap did not write the expected onboarding prompt guidance.");
  }
  if (!fs.readFileSync(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "verification.md"), "utf8").includes("Source: executor")) {
    throw new Error("Executor evidence was not appended to verification.md.");
  }
  const pendingCheckpointText = fs.readFileSync(
    path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "checkpoint.md"),
    "utf8"
  );
  if (!pendingCheckpointText.includes("- Status: needs-proof") || !pendingCheckpointText.includes("- docs/notes.md")) {
    throw new Error("Checkpoint did not surface scoped files awaiting proof.");
  }

  const t003Runs = loadRunRecords(path.join(tempRoot, ".agent-workflow", "tasks", "T-003", "runs"));
  const timedOutRun = t003Runs.find((run) => run.source === "executor");
  if (!timedOutRun || timedOutRun.status !== "failed" || timedOutRun.timedOut !== true) {
    throw new Error("Timed out executor run did not persist timeout metadata.");
  }
  assertExists(path.join(tempRoot, timedOutRun.stdoutFile));
  assertExists(path.join(tempRoot, timedOutRun.stderrFile));
  if (!fs.readFileSync(path.join(tempRoot, ".agent-workflow", "tasks", "T-003", "verification.md"), "utf8").includes("Timed out: true")) {
    throw new Error("Timeout evidence was not appended to verification.md.");
  }

  const port = 4317;
  const server = spawn(process.execPath, [serverPath, "--root", tempRoot, "--port", String(port)], {
    cwd: projectRoot,
    stdio: "ignore",
  });

  try {
    await wait(800);
    const dashboardIndex = await requestText(`http://127.0.0.1:${port}/`);
    const documentHelpersScript = await requestText(`http://127.0.0.1:${port}/document-helpers.js`);
    const taskBoardHelpersScript = await requestText(`http://127.0.0.1:${port}/task-board-helpers.js`);
    if (
      !dashboardIndex.includes('/document-helpers.js') ||
      !dashboardIndex.includes('/task-board-helpers.js') ||
      !documentHelpersScript.includes("AgentWorkflowDashboardDocumentHelpers") ||
      !taskBoardHelpersScript.includes("AgentWorkflowDashboardTaskBoardHelpers")
    ) {
      throw new Error("Dashboard static helper modules were not served correctly after modularization.");
    }

    const overview = await fetchJson(`http://127.0.0.1:${port}/api/overview`);
    if (!overview.initialized || overview.tasks.length !== 2) {
      throw new Error("Unexpected overview payload.");
    }
    const staleMemoryDoc = (overview.memory || []).find((item) => item.name === "architecture.md");
    if (!staleMemoryDoc || staleMemoryDoc.freshnessStatus !== "stale") {
      throw new Error("Overview did not expose stale memory freshness.");
    }
    const staleTask = (overview.tasks || []).find((task) => task.id === "T-003");
    if (!staleTask || staleTask.freshnessStatus !== "stale") {
      throw new Error("Overview did not expose stale task freshness.");
    }
    const t001VerificationGate = (overview.verification || []).find((item) => item.taskId === "T-001");
    if (!t001VerificationGate || t001VerificationGate.status !== "needs-proof") {
      throw new Error("Overview did not expose diff-aware verification proof requirements.");
    }

    await requestJson(`http://127.0.0.1:${port}/api/tasks`, "POST", {
      taskId: "T-002",
      title: "Create from dashboard api",
      priority: "P2",
      recipeId: "review",
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks/T-002`, "PATCH", {
      status: "in_progress",
      priority: "P1",
      recipeId: "audit",
      title: "Create from dashboard api updated",
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks/T-002/runs`, "POST", {
      agent: "manual",
      status: "draft",
      summary: "Dashboard mutation test.",
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks/T-002/documents/task.md`, "PUT", {
      content: `# Temporary heading

## Goal

Ship a dashboard markdown editor.

## Recipe

- Recipe ID: wrong
- Recipe summary: wrong summary that should be replaced

## Scope

- support task.md edits from the dashboard
`,
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks/T-002/documents/context.md`, "PUT", {
      content: `# Wrong context heading

## Recipe guidance

- Recipe ID: wrong
- Recommended for: wrong

## Facts

- Custom fact that should survive managed block refresh.

## Constraints

- Priority: P9
- Keep the workflow docs current.
- Custom constraint: stay local-first.
`,
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks/T-002`, "PATCH", {
      priority: "P0",
      recipeId: "feature",
      title: "Create from dashboard api guardrails",
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks`, "POST", {
      taskId: "T-004",
      title: "Dashboard execution bridge",
      priority: "P2",
      recipeId: "feature",
    });
    codexAdapter.argvTemplate = ["fake-runner.js", "{promptFile}", "{runRequestFile}", "--sleep-ms", "1200"];
    fs.writeFileSync(codexAdapterPath, `${JSON.stringify(codexAdapter, null, 2)}\n`, "utf8");
    const startedDashboardExecution = await requestJson(`http://127.0.0.1:${port}/api/tasks/T-004/execute`, "POST", {
      agent: "codex",
      timeoutMs: 3000,
    });
    if (
      startedDashboardExecution.status !== "starting" ||
      startedDashboardExecution.adapterId !== "codex" ||
      startedDashboardExecution.stdioMode !== "pipe" ||
      !startedDashboardExecution.runId ||
      !String(startedDashboardExecution.stdoutFile || "").endsWith(".stdout.log") ||
      !String(startedDashboardExecution.stderrFile || "").endsWith(".stderr.log")
    ) {
      throw new Error("Dashboard execute API did not report the expected starting state.");
    }
    const runningDashboardExecution = await waitFor(async () => {
      const executionState = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-004/execution`);
      if (executionState.status !== "running" || !executionState.runId || !executionState.stdoutFile) {
        return null;
      }
      return executionState;
    }, 2000, 50);
    if (!runningDashboardExecution) {
      throw new Error("Dashboard execution bridge did not expose a running state with log paths.");
    }
    const activeExecutionStdoutLog = await waitFor(async () => {
      const log = await fetchJson(
        `http://127.0.0.1:${port}/api/tasks/T-004/execution/logs/stdout?maxChars=4000`
      );
      return log.content.includes("stdout T-004 codex") ? log : null;
    }, 2000, 50);
    if (
      !activeExecutionStdoutLog ||
      activeExecutionStdoutLog.active !== true ||
      activeExecutionStdoutLog.pending !== false ||
      activeExecutionStdoutLog.runId !== runningDashboardExecution.runId
    ) {
      throw new Error("Dashboard execution log API did not expose the active stdout tail.");
    }
    const activeExecutionStderrLog = await waitFor(async () => {
      const log = await fetchJson(
        `http://127.0.0.1:${port}/api/tasks/T-004/execution/logs/stderr?maxChars=4000`
      );
      return log.content.includes("stderr T-004 codex") ? log : null;
    }, 2000, 50);
    if (
      !activeExecutionStderrLog ||
      !activeExecutionStderrLog.content.includes("stderr T-004 codex") ||
      activeExecutionStderrLog.active !== true ||
      activeExecutionStderrLog.runId !== runningDashboardExecution.runId
    ) {
      throw new Error("Dashboard execution log API did not expose the active stderr tail.");
    }
    const runningExecutionDetail = await waitFor(async () => {
      const executionState = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-004/execution`);
      if (
        executionState.activity !== "streaming-output" ||
        !executionState.lastOutputAt ||
        typeof executionState.totalOutputBytes !== "number" ||
        executionState.totalOutputBytes <= 0 ||
        !executionState.streams ||
        !executionState.streams.stdout ||
        executionState.streams.stdout.exists !== true ||
        typeof executionState.streams.stdout.size !== "number" ||
        executionState.streams.stdout.size <= 0 ||
        !executionState.streams.stderr ||
        executionState.streams.stderr.exists !== true
      ) {
        return null;
      }

      return executionState;
    }, 2000, 50);
    if (!runningExecutionDetail) {
      throw new Error("Dashboard execution state did not expose derived stream observability.");
    }
    const completedDashboardExecution = await waitFor(async () => {
      const executionState = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-004/execution`);
      if (executionState.status === "starting" || executionState.status === "running") {
        return null;
      }
      return executionState;
    }, 5000, 100);
    if (
      !completedDashboardExecution ||
      completedDashboardExecution.status !== "completed" ||
      completedDashboardExecution.outcome !== "passed" ||
      completedDashboardExecution.runStatus !== "passed" ||
      !completedDashboardExecution.runId
    ) {
      throw new Error("Dashboard execution bridge did not complete with a persisted executor run.");
    }
    const dashboardExecuteDetail = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-004`);
    if (
      !dashboardExecuteDetail.executionState ||
      dashboardExecuteDetail.executionState.status !== "completed" ||
      dashboardExecuteDetail.executionState.outcome !== "passed" ||
      dashboardExecuteDetail.executionState.runId !== completedDashboardExecution.runId
    ) {
      throw new Error("Task detail did not expose the latest dashboard execution state.");
    }
    const dashboardExecuteRun = (dashboardExecuteDetail.runs || []).find(
      (run) => run.id === completedDashboardExecution.runId
    );
    if (!dashboardExecuteRun || dashboardExecuteRun.source !== "executor" || dashboardExecuteRun.status !== "passed") {
      throw new Error("Dashboard execution bridge did not persist the executor run in task detail.");
    }
    const dashboardStdoutLog = await fetchJson(
      `http://127.0.0.1:${port}/api/tasks/T-004/runs/${encodeURIComponent(completedDashboardExecution.runId)}/logs/stdout`
    );
    if (!dashboardStdoutLog.content.includes("stdout T-004 codex")) {
      throw new Error("Dashboard execution bridge did not expose executor stdout through the local log API.");
    }
    try {
      await requestJson(`http://127.0.0.1:${port}/api/tasks/T-004/runs/run-missing/logs/stdout`, "GET");
      throw new Error("Run log API should reject unknown run ids.");
    } catch (error) {
      if (error.statusCode !== 404 || !String(error.message || "").includes("does not exist for task")) {
        throw error;
      }
    }
    codexAdapter.stdioMode = "inherit";
    fs.writeFileSync(codexAdapterPath, `${JSON.stringify(codexAdapter, null, 2)}\n`, "utf8");
    try {
      await requestJson(`http://127.0.0.1:${port}/api/tasks/T-004/execute`, "POST", {
        agent: "codex",
      });
      throw new Error("Dashboard execute API should reject interactive inherit mode.");
    } catch (error) {
      if (error.statusCode !== 400 || !String(error.message || "").includes("Use the CLI for interactive execution")) {
        throw error;
      }
    }
    codexAdapter.stdioMode = "pipe";
    fs.writeFileSync(codexAdapterPath, `${JSON.stringify(codexAdapter, null, 2)}\n`, "utf8");
    await requestJson(`http://127.0.0.1:${port}/api/tasks`, "POST", {
      taskId: "T-005",
      title: "Dashboard execution cancel bridge",
      priority: "P2",
      recipeId: "feature",
    });
    codexAdapter.argvTemplate = ["fake-runner.js", "{promptFile}", "{runRequestFile}", "--sleep-ms", "1500"];
    fs.writeFileSync(codexAdapterPath, `${JSON.stringify(codexAdapter, null, 2)}\n`, "utf8");
    const startedCancelledExecution = await requestJson(`http://127.0.0.1:${port}/api/tasks/T-005/execute`, "POST", {
      agent: "codex",
      timeoutMs: 5000,
    });
    if (startedCancelledExecution.status !== "starting") {
      throw new Error("Dashboard cancel test did not start from the expected execution state.");
    }
    const cancelRequestedState = await requestJson(`http://127.0.0.1:${port}/api/tasks/T-005/execution/cancel`, "POST", {});
    if (cancelRequestedState.status !== "cancel-requested" || !cancelRequestedState.cancelRequestedAt) {
      throw new Error("Dashboard cancel API did not report a cancel-requested state.");
    }
    if (cancelRequestedState.outcome !== null) {
      throw new Error("Dashboard cancel-requested state should not claim a final execution outcome yet.");
    }
    const cancelledExecution = await waitFor(async () => {
      const executionState = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-005/execution`);
      if (
        executionState.status === "starting" ||
        executionState.status === "running" ||
        executionState.status === "cancel-requested"
      ) {
        return null;
      }
      return executionState;
    }, 7000, 100);
    if (
      !cancelledExecution ||
      cancelledExecution.status !== "completed" ||
      cancelledExecution.outcome !== "cancelled" ||
      cancelledExecution.runStatus !== "failed" ||
      !String(cancelledExecution.summary || "").includes("dashboard-cancel")
    ) {
      throw new Error("Dashboard cancel flow did not finish as an interrupted executor run.");
    }
    const cancelledDetail = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-005`);
    if (
      !cancelledDetail.executionState ||
      cancelledDetail.executionState.status !== "completed" ||
      cancelledDetail.executionState.outcome !== "cancelled" ||
      cancelledDetail.executionState.runId !== cancelledExecution.runId
    ) {
      throw new Error("Task detail did not expose the cancelled dashboard execution state.");
    }
    const cancelledRun = (cancelledDetail.runs || []).find((run) => run.id === cancelledExecution.runId);
    if (
      !cancelledRun ||
      cancelledRun.source !== "executor" ||
      cancelledRun.status !== "failed" ||
      cancelledRun.interrupted !== true ||
      cancelledRun.interruptionSignal !== "dashboard-cancel"
    ) {
      throw new Error("Cancelled dashboard execution did not persist interruption metadata.");
    }
    const cancelledStdoutLog = await fetchJson(
      `http://127.0.0.1:${port}/api/tasks/T-005/runs/${encodeURIComponent(cancelledExecution.runId)}/logs/stdout`
    );
    if (cancelledStdoutLog.stream !== "stdout" || !cancelledStdoutLog.path.endsWith(".stdout.log")) {
      throw new Error("Cancelled dashboard execution did not preserve stdout log access.");
    }
    try {
      await requestJson(`http://127.0.0.1:${port}/api/tasks/T-005/execution/cancel`, "POST", {});
      throw new Error("Dashboard cancel API should reject tasks without an active execution.");
    } catch (error) {
      if (error.statusCode !== 409 || !String(error.message || "").includes("no active dashboard execution")) {
        throw error;
      }
    }

    const detail = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-001`);
    if (!detail.meta || detail.meta.recipeId !== "feature") {
      throw new Error("Task detail payload is missing recipe information.");
    }
    if (!detail.verificationGate || detail.verificationGate.summary.status !== "needs-proof") {
      throw new Error("Task detail did not expose a diff-aware proof requirement.");
    }
    const relevantNoteChange = (detail.verificationGate.relevantChangedFiles || []).find((file) => file.path === "docs/notes.md");
    if (!relevantNoteChange) {
      throw new Error("Task detail did not expose the scoped changed file.");
    }
    const stdoutLog = await fetchJson(
      `http://127.0.0.1:${port}/api/tasks/T-001/runs/${encodeURIComponent(executorRun.id)}/logs/stdout`
    );
    if (!stdoutLog.content.includes("stdout T-001 codex") || stdoutLog.stream !== "stdout") {
      throw new Error("Run log API did not return the expected stdout content.");
    }
    const weakProofDetail = await requestJson(`http://127.0.0.1:${port}/api/tasks/T-001/documents/verification.md`, "PUT", {
      content: `# T-001 Verification

## Planned checks

- automated: node fake-runner.js
- manual: reviewed the latest scanner-related work after the executor run

## Blocking gaps

- none
`,
    });
    if (!weakProofDetail.verificationGate || weakProofDetail.verificationGate.summary.status !== "needs-proof") {
      throw new Error("Generic verification text should not satisfy scoped proof requirements.");
    }
    const draftedProofDetail = await requestJson(`http://127.0.0.1:${port}/api/tasks/T-001/documents/verification.md`, "PUT", {
      content: mergeVerificationProofPlanDraft(weakProofDetail.verificationText, weakProofDetail),
    });
    if (
      !draftedProofDetail.verificationText.includes("- Files: docs/notes.md") ||
      !draftedProofDetail.verificationText.includes("- manual: Review docs/notes.md diff")
    ) {
      throw new Error("Verification draft shortcut did not insert the pending proof plan into verification.md.");
    }
    if (!draftedProofDetail.verificationGate || draftedProofDetail.verificationGate.summary.status !== "needs-proof") {
      throw new Error("Drafted verification proof plans should not satisfy the verification gate by themselves.");
    }
    const manualProofDetail = await requestJson(`http://127.0.0.1:${port}/api/tasks/T-001/documents/verification.md`, "PUT", {
      content: `# T-001 Verification

## Planned checks

- automated: node fake-runner.js
- manual: reviewed docs/notes.md after the executor run

## Proof links

### Proof 1

- Files: docs/notes.md
- Check: reviewed docs/notes.md diff after the executor run
- Result: passed
- Artifact: ${executorRun.stdoutFile}

## Blocking gaps

- none
`,
    });
    if (!manualProofDetail.verificationGate || manualProofDetail.verificationGate.summary.status !== "covered") {
      throw new Error("Structured proof links did not satisfy the diff-aware gate.");
    }
    const manualProofItem = ((manualProofDetail.verificationGate.proofCoverage || {}).items || []).find(
      (item) => item.sourceType === "manual" && (item.paths || []).includes("docs/notes.md")
    );
    if (
      !manualProofItem ||
      !manualProofItem.strong ||
      !(manualProofItem.artifacts || []).includes(executorRun.stdoutFile) ||
      !(manualProofItem.checks || []).some((check) => check.includes("result: passed"))
    ) {
      throw new Error("Manual proof item was not parsed into strong scoped coverage.");
    }
    const manualAnchorRefreshDetail = await requestJson(
      `http://127.0.0.1:${port}/api/tasks/T-001/verification/anchors/refresh`,
      "POST",
      {}
    );
    if (
      !manualAnchorRefreshDetail.manualProofAnchorRefresh ||
      manualAnchorRefreshDetail.manualProofAnchorRefresh.refreshedCount !== 1 ||
      !manualAnchorRefreshDetail.verificationText.includes("verification-manual-proof-anchors:start")
    ) {
      throw new Error("Manual proof anchor refresh did not persist the managed verification anchor block.");
    }
    const anchoredManualProofItem = ((manualAnchorRefreshDetail.verificationGate.proofCoverage || {}).items || []).find(
      (item) => item.sourceType === "manual" && (item.paths || []).includes("docs/notes.md")
    );
    if (!anchoredManualProofItem || anchoredManualProofItem.anchorCount < 1) {
      throw new Error("Manual proof anchors were not reflected in task detail proof coverage.");
    }

    fs.writeFileSync(
      path.join(tempRoot, "docs", "notes.md"),
      "# Notes\n\nThe scanner should discover this file.\n\nDiff-aware verification should detect this follow-up change.\n\nManual proof anchors should reopen proof after this fresh edit.\n",
      "utf8"
    );
    const reopenedManualProofDetail = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-001`);
    if (!reopenedManualProofDetail.verificationGate || reopenedManualProofDetail.verificationGate.summary.status !== "needs-proof") {
      throw new Error("Manual proof anchors did not reopen proof after the scoped file changed again.");
    }
    const structuredDashboardRun = parseRunEvidenceDraft({
      status: "passed",
      scopeProofPaths: "docs/notes.md",
      verificationChecks: `Reviewed docs/notes.md diff after the executor run\npassed | executor stdout captured | local executor output linked | ${executorRun.stdoutFile}`,
      verificationArtifacts: executorRun.stdoutFile,
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks/T-001/runs`, "POST", {
      agent: "manual",
      status: "passed",
      summary: "Manual scoped proof recorded.",
      ...structuredDashboardRun,
    });
    const coveredDetail = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-001`);
    if (!coveredDetail.verificationGate || coveredDetail.verificationGate.summary.status !== "covered") {
      throw new Error("Explicit scope-linked run evidence did not satisfy the diff-aware gate.");
    }
    const manualProofRun = (coveredDetail.runs || []).find((run) => run.summary === "Manual scoped proof recorded.");
    if (
      !manualProofRun ||
      !Array.isArray(manualProofRun.scopeProofPaths) ||
      !manualProofRun.scopeProofPaths.includes("docs/notes.md") ||
      !Array.isArray(manualProofRun.scopeProofAnchors) ||
      !manualProofRun.scopeProofAnchors.some((anchor) => anchor.path === "docs/notes.md") ||
      !Array.isArray(manualProofRun.verificationArtifacts) ||
      !manualProofRun.verificationArtifacts.includes(executorRun.stdoutFile) ||
      !Array.isArray(manualProofRun.verificationChecks) ||
      !manualProofRun.verificationChecks.some((check) => check.label === "Reviewed docs/notes.md diff after the executor run") ||
      !manualProofRun.verificationChecks.some((check) => check.label === "executor stdout captured")
    ) {
      throw new Error("Passed run did not persist structured verification evidence.");
    }
    const runProofItem = ((coveredDetail.verificationGate.proofCoverage || {}).items || []).find(
      (item) => item.sourceType === "run" && item.sourceLabel === manualProofRun.id
    );
    if (
      !runProofItem ||
      !runProofItem.strong ||
      !(runProofItem.paths || []).includes("docs/notes.md") ||
      !(runProofItem.checks || []).some((check) => check.includes("[passed] Reviewed docs/notes.md diff after the executor run")) ||
      !(runProofItem.checks || []).some((check) => check.includes("[passed] executor stdout captured")) ||
      !(runProofItem.artifacts || []).includes(executorRun.stdoutFile)
    ) {
      throw new Error("Run evidence was not exposed as a strong structured proof item.");
    }
    const coveredCheckpointText = fs.readFileSync(
      path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "checkpoint.md"),
      "utf8"
    );
    if (!coveredCheckpointText.includes("- Status: covered")) {
      throw new Error("Checkpoint did not refresh after verification proof was updated.");
    }
    if (!fs.readFileSync(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "verification.md"), "utf8").includes("Scoped files covered: docs/notes.md")) {
      throw new Error("Verification evidence block did not record scoped proof paths.");
    }

    fs.writeFileSync(
      path.join(tempRoot, "README.md"),
      "# Smoke Workspace\n\nThis repo exists to validate Agent Workflow Studio.\n\nCLI proof should cover this follow-up README change.\n",
      "utf8"
    );
    runNode(cliPath, [
      "run:add",
      "T-001",
      "README proof recorded.",
      "--status",
      "passed",
      "--proof-path",
      "README.md",
      "--check",
      "Reviewed README.md diff after CLI run",
      "--artifact",
      ".agent-workflow/tasks/T-001/checkpoint.md",
      "--root",
      tempRoot,
    ]);
    const cliProofDetail = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-001`);
    const cliProofRun = (cliProofDetail.runs || []).find((run) => run.summary === "README proof recorded.");
    if (
      !cliProofRun ||
      !Array.isArray(cliProofRun.scopeProofPaths) ||
      !cliProofRun.scopeProofPaths.includes("README.md") ||
      !Array.isArray(cliProofRun.scopeProofAnchors) ||
      !cliProofRun.scopeProofAnchors.some((anchor) => anchor.path === "README.md") ||
      !Array.isArray(cliProofRun.verificationArtifacts) ||
      !cliProofRun.verificationArtifacts.includes(".agent-workflow/tasks/T-001/checkpoint.md") ||
      !Array.isArray(cliProofRun.verificationChecks) ||
      !cliProofRun.verificationChecks.some((check) => check.label === "Reviewed README.md diff after CLI run")
    ) {
      throw new Error("CLI run:add flags did not persist structured proof evidence.");
    }
    if (!cliProofDetail.verificationGate || cliProofDetail.verificationGate.summary.status !== "covered") {
      throw new Error("CLI structured proof did not keep scoped verification covered.");
    }
    const detail3 = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-003`);
    if (!detail3.freshness || !detail3.freshness.summary || detail3.freshness.summary.status !== "stale") {
      throw new Error("Task detail did not expose stale freshness summary.");
    }
    const staleContext = (detail3.freshness.docs || []).find((doc) => doc.name === "context.md");
    if (!staleContext || staleContext.status !== "stale") {
      throw new Error("Task detail did not expose stale context freshness.");
    }

    const detail2 = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-002`);
    if (
      !detail2.meta ||
      detail2.meta.recipeId !== "feature" ||
      detail2.meta.status !== "in_progress" ||
      detail2.meta.priority !== "P0"
    ) {
      throw new Error("Task mutation endpoints did not persist task metadata.");
    }
    if (!Array.isArray(detail2.runs) || detail2.runs.length !== 1) {
      throw new Error("Run creation endpoint did not persist evidence.");
    }
    if (!detail2.taskText.includes("Ship a dashboard markdown editor.")) {
      throw new Error("Document editor endpoint did not persist custom task.md content.");
    }
    if (!detail2.taskText.includes("# T-002 - Create from dashboard api guardrails")) {
      throw new Error("Document editor endpoint did not keep the managed task heading in sync.");
    }
    if (
      !detail2.taskText.includes("- Recipe ID: feature") ||
      !detail2.taskText.includes("<!-- agent-workflow:managed:task-recipe-meta:start -->") ||
      detail2.taskText.includes("wrong summary that should be replaced")
    ) {
      throw new Error("Document editor endpoint did not keep the managed task recipe block stable.");
    }
    if (
      !detail2.contextText.includes("# T-002 Context") ||
      !detail2.contextText.includes("- Recipe ID: feature") ||
      !detail2.contextText.includes("- Priority: P0") ||
      !detail2.contextText.includes("- Custom constraint: stay local-first.") ||
      !detail2.contextText.includes("Custom fact that should survive managed block refresh.") ||
      !detail2.contextText.includes("<!-- agent-workflow:managed:context-recipe-guidance:start -->") ||
      !detail2.contextText.includes("<!-- agent-workflow:managed:context-constraints-meta:start -->") ||
      detail2.contextText.includes("- Priority: P9") ||
      detail2.contextText.includes("- Recipe ID: wrong")
    ) {
      throw new Error("Context markdown guardrails did not preserve custom content while refreshing managed blocks.");
    }
    const t002CheckpointText = fs.readFileSync(
      path.join(tempRoot, ".agent-workflow", "tasks", "T-002", "checkpoint.md"),
      "utf8"
    );
    if (!t002CheckpointText.includes("Task scope does not include clear repo-relative paths yet")) {
      throw new Error("Checkpoint did not surface weak scope coverage after task.md editing.");
    }

    const overview2 = await fetchJson(`http://127.0.0.1:${port}/api/overview`);
    if (overview2.tasks.length !== 5) {
      throw new Error("Overview did not reflect created task.");
    }
    if (
      !overview2.stats ||
      !overview2.stats.executorOutcomes ||
      overview2.stats.executorOutcomes.passed !== 2 ||
      overview2.stats.executorOutcomes.timedOut !== 1 ||
      overview2.stats.executorOutcomes.cancelled !== 1 ||
      overview2.stats.executorOutcomes.failed !== 0 ||
      overview2.stats.executorOutcomes.interrupted !== 0 ||
      overview2.stats.executorOutcomes.none !== 1
    ) {
      throw new Error("Overview did not aggregate the latest executor outcomes across tasks.");
    }
    if (
      !overview2.stats.verificationSignals ||
      overview2.stats.verificationSignals.strong !== 1 ||
      overview2.stats.verificationSignals.mixed !== 0 ||
      overview2.stats.verificationSignals.draft !== 0 ||
      overview2.stats.verificationSignals.planned !== 0 ||
      overview2.stats.verificationSignals.none !== 4
    ) {
      throw new Error("Overview did not aggregate verification signal states across tasks.");
    }
    const t001CoveredGate = (overview2.verification || []).find((item) => item.taskId === "T-001");
    if (!t001CoveredGate || t001CoveredGate.status !== "covered") {
      throw new Error("Overview did not refresh diff-aware verification state after proof was updated.");
    }
    const t001OverviewTask = (overview2.tasks || []).find((task) => task.id === "T-001");
    if (
      !t001OverviewTask ||
      t001OverviewTask.latestExecutorOutcome !== "passed" ||
      t001OverviewTask.verificationSignalStatus !== "strong" ||
      !String(t001OverviewTask.verificationSignalSummary || "").includes("strong proof")
    ) {
      throw new Error("Overview task summary did not preserve the latest executor outcome and verification signal for T-001.");
    }
    const t004OverviewTask = (overview2.tasks || []).find((task) => task.id === "T-004");
    if (
      !t004OverviewTask ||
      t004OverviewTask.latestExecutorOutcome !== "passed" ||
      !String(t004OverviewTask.latestExecutorSummary || "").includes("Executor completed with exit code 0.") ||
      t004OverviewTask.verificationSignalStatus !== "none"
    ) {
      throw new Error("Overview task summary did not expose the passed executor outcome and verification signal for T-004.");
    }
    const t005OverviewTask = (overview2.tasks || []).find((task) => task.id === "T-005");
    if (
      !t005OverviewTask ||
      t005OverviewTask.latestExecutorOutcome !== "cancelled" ||
      !String(t005OverviewTask.latestExecutorSummary || "").includes("dashboard-cancel") ||
      t005OverviewTask.verificationSignalStatus !== "none"
    ) {
      throw new Error("Overview task summary did not expose the cancelled executor outcome and verification signal for T-005.");
    }
  } finally {
    server.kill();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  process.stdout.write("Smoke test passed.\n");
}

function runNode(scriptPath, args) {
  execFileSync(process.execPath, [scriptPath, ...args], {
    stdio: "ignore",
  });
}

function runNodeOutput(scriptPath, args) {
  const captureRoot = path.join(__dirname, "..", "tmp", "smoke-command-output");
  fs.mkdirSync(captureRoot, { recursive: true });
  const outputPath = path.join(captureRoot, `${Date.now()}-${Math.random().toString(16).slice(2)}.log`);
  const outputFd = fs.openSync(outputPath, "w");

  try {
    execFileSync(process.execPath, [scriptPath, ...args], {
      stdio: ["ignore", outputFd, "ignore"],
    });
  } finally {
    fs.closeSync(outputFd);
  }

  return fs.readFileSync(outputPath, "utf8");
}

function runNodeExpectFailure(scriptPath, args) {
  try {
    execFileSync(process.execPath, [scriptPath, ...args], {
      stdio: "ignore",
    });
  } catch (error) {
    if (error.status && error.status !== 0) {
      return;
    }
    throw error;
  }

  throw new Error(`Expected command to fail: ${[scriptPath, ...args].join(" ")}`);
}

function runCommand(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: "ignore",
  });
}

function assertExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${filePath}`);
  }
}

function loadRunRecords(runsRoot) {
  return fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => JSON.parse(fs.readFileSync(path.join(runsRoot, entry.name), "utf8")));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, timeoutMs, intervalMs = 100) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await check();
    if (value) {
      return value;
    }
    await wait(intervalMs);
  }

  return null;
}

function fetchJson(url) {
  return requestJson(url, "GET");
}

function requestText(url) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method: "GET" }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        if (response.statusCode >= 400) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        resolve(body);
      });
    });

    request.on("error", reject);
    request.end();
  });
}

function requestJson(url, method, payload) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method,
        headers: payload
          ? {
              "Content-Type": "application/json",
            }
          : {},
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            if (response.statusCode >= 400) {
              const error = new Error(parsed.error || `HTTP ${response.statusCode}`);
              error.statusCode = response.statusCode;
              reject(error);
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);

    if (payload) {
      request.write(JSON.stringify(payload));
    }

    request.end();
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

