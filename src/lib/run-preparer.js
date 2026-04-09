const path = require("path");
const { fileExists, readJson, writeFile, writeJson } = require("./fs-utils");
const { getAdapter, normalizeAdapterId, resolvePromptTargetForAdapter } = require("./adapters");
const { compilePrompt } = require("./prompt-compiler");
const { notFound } = require("./http-errors");
const { taskFiles } = require("./workspace");

function prepareRun(workspaceRoot, taskId, adapterInput) {
  const adapterId = normalizeAdapterId(adapterInput || "codex");
  const adapter = getAdapter(workspaceRoot, adapterId);
  const files = taskFiles(workspaceRoot, taskId);

  if (!fileExists(files.meta)) {
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
  }

  const promptTarget = resolvePromptTargetForAdapter(adapter);
  const promptPath = path.join(files.root, adapter.promptFile);
  if (!fileExists(promptPath)) {
    const compiledPrompt = compilePrompt(workspaceRoot, taskId, promptTarget);
    if (path.resolve(compiledPrompt.outputPath) !== path.resolve(promptPath)) {
      writeFile(promptPath, compiledPrompt.prompt);
    }
  }

  const task = readJson(files.meta, {});
  const runRequest = {
    schemaVersion: 1,
    taskId,
    adapterId,
    title: task.title,
    generatedAt: new Date().toISOString(),
    workspaceRoot: ".",
    taskRoot: path.join(".agent-workflow", "tasks", taskId).replace(/\\/g, "/"),
    promptFile: path.join(".agent-workflow", "tasks", taskId, adapter.promptFile).replace(/\\/g, "/"),
    launchPackFile: path.join(".agent-workflow", "tasks", taskId, adapter.launchPackFile).replace(/\\/g, "/"),
    expectedOutputs: [
      "code changes or confirmed no-op",
      "updated workflow docs",
      "clear verification status",
      "explicit unresolved risks",
    ],
    runnerCommand: adapter.runnerCommand || [],
    commandMode: adapter.commandMode || "manual",
    stdinMode: adapter.stdinMode || "none",
    capabilities: adapter.capabilities || {},
  };

  const runRequestPath = path.join(files.root, adapter.runRequestFile);
  const launchPackPath = path.join(files.root, adapter.launchPackFile);
  writeJson(runRequestPath, runRequest);
  writeFile(launchPackPath, renderLaunchPack(taskId, task.title, adapter, runRequest));

  return {
    adapterId,
    runRequestPath,
    launchPackPath,
    promptPath,
  };
}

function renderLaunchPack(taskId, title, adapter, runRequest) {
  const runnerHint =
    Array.isArray(adapter.runnerCommand) && adapter.runnerCommand.length > 0
      ? `- Local runner hint: \`${adapter.runnerCommand.join(" ")}\``
      : "- Local runner hint: configure runnerCommand in the adapter config first.";

  return `# Launch Pack - ${taskId}

## Adapter

- Name: ${adapter.name}
- Adapter ID: ${adapter.adapterId}
- Command mode: ${adapter.commandMode}
${runnerHint}
- stdin mode: ${adapter.stdinMode || "none"}

## Task

- ID: ${taskId}
- Title: ${title}

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- ${runRequest.promptFile}

## Suggested operator flow

1. Start the agent in the target repository root.
2. Give it the prompt file above as the primary instruction bundle.
3. Keep the run within task scope and update workflow docs during execution.
4. After the run, record evidence and refresh checkpoint.md.

## Expected outputs

- code changes or confirmed no-op
- updated workflow docs
- clear verification status
- explicit unresolved risks
`;
}

module.exports = {
  prepareRun,
};
