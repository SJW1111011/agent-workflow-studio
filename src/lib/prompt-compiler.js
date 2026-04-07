const { fileExists, readJson, readText, writeFile } = require("./fs-utils");
const { notFound } = require("./http-errors");
const { getRecipe } = require("./recipes");
const { projectProfilePath, taskFiles } = require("./workspace");

function compilePrompt(workspaceRoot, taskId, agent = "codex") {
  const files = taskFiles(workspaceRoot, taskId);

  if (!fileExists(files.meta)) {
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
  }

  const taskMeta = readJson(files.meta, {});
  const recipe = getRecipe(workspaceRoot, taskMeta.recipeId);

  const prompt = renderPrompt({
    agent,
    taskId,
    recipe,
    taskText: readText(files.task, ""),
    contextText: readText(files.context, ""),
    verificationText: readText(files.verification, ""),
    hasProjectProfile: fileExists(projectProfilePath(workspaceRoot)),
  });

  const outputPath =
    agent === "claude" ? files.promptClaude : files.promptCodex;

  writeFile(outputPath, prompt);

  return {
    agent,
    outputPath,
    prompt,
  };
}

function excerpt(text, maxLength = 1200) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

function renderPrompt({ agent, taskId, recipe, taskText, contextText, verificationText, hasProjectProfile }) {
  const agentName = agent === "claude" ? "Claude Code" : "Codex";
  const agentHints =
    agent === "claude"
      ? [
          "- Keep the repository memory aligned with any structural changes.",
          "- Prefer concise implementation notes and explicit assumptions.",
          "- Keep handoff quality high for future agent sessions.",
        ]
      : [
          "- Be explicit about the files you inspect, edit, and validate.",
          "- Keep changes narrow and evidence-backed.",
          "- Update workflow docs immediately after each meaningful step.",
        ];

  return `# ${taskId} Prompt for ${agentName}

## Mission

Complete the task truthfully and leave the repository easier for the next agent to understand.

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md${hasProjectProfile ? "" : " (missing: run scan first when possible)"}
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/recipes/${recipe ? recipe.fileName : "feature.md"}
- .agent-workflow/tasks/${taskId}/task.md
- .agent-workflow/tasks/${taskId}/context.md
- .agent-workflow/tasks/${taskId}/verification.md

## Recipe

- Recipe ID: ${recipe ? recipe.id : "feature"}
- Recipe summary: ${recipe ? recipe.summary : "No recipe summary available"}

## Task brief

${excerpt(taskText)}

## Working context

${excerpt(contextText)}

## Verification expectations

${excerpt(verificationText)}

## Required behaviors

- Stay within the requested scope.
- Call out fake implementations and unverified assumptions.
- Record runs in .agent-workflow/tasks/${taskId}/runs.
- Refresh checkpoint.md before handing off.
- If verification is incomplete, say so plainly.

## ${agentName} notes

${agentHints.join("\n")}

## Final output

- implemented changes
- updated workflow docs
- verification status
- unresolved risks
`;
}

module.exports = {
  compilePrompt,
};

