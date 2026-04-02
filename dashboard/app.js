let activeTaskId = null;
let activeTaskDetail = null;
let activeDocumentName = "task.md";

const EDITABLE_DOCUMENTS = {
  "task.md": {
    detailField: "taskText",
    note: "Task title and recipe block stay synced from task.json.",
  },
  "context.md": {
    detailField: "contextText",
    note: "Recipe guidance and priority stay synced from task.json.",
  },
  "verification.md": {
    detailField: "verificationText",
    note: "Run evidence can still append to verification.md after edits.",
  },
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error((payload && payload.error) || `Failed to load ${url}`);
  }

  return payload;
}

function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function patchJson(url, body) {
  return fetchJson(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function putJson(url, body) {
  return fetchJson(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function loadOverview() {
  return fetchJson("/api/overview");
}

async function loadTaskDetail(taskId) {
  return fetchJson(`/api/tasks/${encodeURIComponent(taskId)}`);
}

function renderStats(stats) {
  const container = document.getElementById("stats");
  const entries = [
    ["Tasks", stats.tasks],
    ["Runs", stats.runs],
    ["Risks", stats.risks],
    ["Memory Docs", stats.memoryDocs],
  ];

  container.innerHTML = entries
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <h3>${label}</h3>
          <strong>${value}</strong>
        </article>
      `
    )
    .join("");
}

function renderTasks(tasks) {
  renderCollection(
    "tasks",
    tasks,
    (task) => `
      <article class="task-card ${task.id === activeTaskId ? "active" : ""}" data-task-id="${escapeHtml(task.id)}">
        <h3>${task.id} - ${escapeHtml(task.title || "Untitled task")}</h3>
        <p class="task-meta">Priority ${escapeHtml(task.priority || "P2")} | ${escapeHtml(task.status || "todo")} | Recipe ${escapeHtml(task.recipeId || "feature")}</p>
        <p>${escapeHtml(task.latestRunSummary || "No runs yet")}</p>
        <div class="tag-row">
          <span class="tag">${task.hasCodexPrompt ? "Codex prompt" : "No Codex prompt"}</span>
          <span class="tag">${task.hasClaudePrompt ? "Claude prompt" : "No Claude prompt"}</span>
          <span class="tag ${task.latestRunStatus === "failed" ? "warn" : ""}">${escapeHtml(task.latestRunStatus)}</span>
        </div>
      </article>
    `
  );

  document.querySelectorAll("[data-task-id]").forEach((node) => {
    node.addEventListener("click", () => {
      selectTask(node.getAttribute("data-task-id"));
    });
  });
}

function renderAdapters(adapters) {
  renderCollection(
    "adapters",
    adapters,
    (adapter) => `
      <article class="list-item">
        <h3>${escapeHtml(adapter.displayName || adapter.adapterId)}</h3>
        <p class="subtle">${escapeHtml(adapter.adapterId)}</p>
        <div class="tag-row">
          <span class="tag ${adapter.exists ? "" : "warn"}">${adapter.exists ? "Configured" : "Missing"}</span>
          <span class="tag">${escapeHtml((((adapter.config && adapter.config.runnerCommand) || [])).join(" ") || "No runner hint")}</span>
        </div>
      </article>
    `
  );
}

function renderRecipes(recipes) {
  renderCollection(
    "recipes",
    recipes,
    (recipe) => `
      <article class="list-item">
        <h3>${escapeHtml(recipe.name)}</h3>
        <p>${escapeHtml(recipe.summary)}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml(recipe.id)}</span>
          <span class="tag">${escapeHtml((recipe.recommendedFor || []).join(", ") || "General")}</span>
        </div>
      </article>
    `
  );
}

function renderValidation(report) {
  const items = [];

  items.push({
    title: report.ok ? "Workspace schema looks coherent" : "Schema issues detected",
    body: `Errors: ${report.errorCount}, warnings: ${report.warningCount}`,
    warn: !report.ok,
  });

  (report.issues || []).slice(0, 5).forEach((issue) => {
    items.push({
      title: `${issue.level.toUpperCase()} - ${issue.code}`,
      body: `${issue.message} (${issue.target})`,
      warn: issue.level === "error",
    });
  });

  renderCollection(
    "validation",
    items,
    (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
        <div class="tag-row">
          <span class="tag ${item.warn ? "warn" : ""}">${item.warn ? "Needs attention" : "Healthy"}</span>
        </div>
      </article>
    `
  );
}

function renderTaskDetail(detail) {
  const container = document.getElementById("task-detail");
  activeTaskDetail = detail || null;

  if (!detail) {
    container.innerHTML = '<div class="empty">Select a task to inspect its detail bundle.</div>';
    populateTaskForms(null);
    return;
  }

  const generatedFiles = (detail.generatedFiles || [])
    .map(
      (item) => `
        <article class="list-item">
          <h3>${escapeHtml(item.name)}</h3>
          <div class="tag-row">
            <span class="tag ${item.exists ? "" : "warn"}">${item.exists ? "Generated" : "Missing"}</span>
          </div>
        </article>
      `
    )
    .join("");

  const schemaIssues = (detail.schemaIssues || []).length
    ? (detail.schemaIssues || [])
        .map(
          (issue) => `
            <article class="list-item">
              <h3>${escapeHtml(issue.level.toUpperCase())} - ${escapeHtml(issue.code)}</h3>
              <p>${escapeHtml(issue.message)}</p>
              <p class="subtle">${escapeHtml(issue.target)}</p>
            </article>
          `
        )
        .join("")
    : '<div class="empty">No task-level schema issues detected.</div>';

  const runItems = (detail.runs || []).length
    ? (detail.runs || [])
        .map(
          (run) => `
            <article class="list-item">
              <h3>${escapeHtml(run.agent || "manual")} - ${escapeHtml(run.status)}</h3>
              <p>${escapeHtml(run.summary)}</p>
              <p class="subtle">${escapeHtml(run.createdAt)}</p>
            </article>
          `
        )
        .join("")
    : '<div class="empty">No runs recorded yet.</div>';

  container.innerHTML = `
    <div class="detail-grid">
      <article class="detail-card">
        <h3>${escapeHtml(detail.meta.id)} - ${escapeHtml(detail.meta.title)}</h3>
        <p class="subtle">Priority ${escapeHtml(detail.meta.priority || "P2")} | Status ${escapeHtml(detail.meta.status || "todo")}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml((detail.recipe && detail.recipe.id) || detail.meta.recipeId || "feature")}</span>
          <span class="tag">${escapeHtml((detail.recipe && detail.recipe.name) || "Unknown recipe")}</span>
        </div>
        <p>${escapeHtml((detail.recipe && detail.recipe.summary) || "No recipe summary available.")}</p>
      </article>

      <article class="detail-card">
        <h3>Generated Files</h3>
        <div class="list">${generatedFiles}</div>
      </article>

      <article class="detail-card wide">
        <h3>Task Brief</h3>
        <pre class="detail-pre">${escapeHtml(detail.taskText || "No task.md content.")}</pre>
      </article>

      <article class="detail-card">
        <h3>Context</h3>
        <pre class="detail-pre">${escapeHtml(detail.contextText || "No context.md content.")}</pre>
      </article>

      <article class="detail-card">
        <h3>Verification</h3>
        <pre class="detail-pre">${escapeHtml(detail.verificationText || "No verification.md content.")}</pre>
      </article>

      <article class="detail-card">
        <h3>Runs</h3>
        <div class="list">${runItems}</div>
      </article>

      <article class="detail-card">
        <h3>Schema Issues</h3>
        <div class="list">${schemaIssues}</div>
      </article>
    </div>
  `;

  populateTaskForms(detail);
}

function renderMemory(memory) {
  renderCollection(
    "memory",
    memory,
    (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.name)}</h3>
        <p class="subtle">${escapeHtml(item.relativePath)}</p>
        <div class="tag-row">
          <span class="tag ${item.placeholder ? "warn" : ""}">${item.placeholder ? "Placeholder" : "Ready"}</span>
          <span class="tag">${item.size} chars</span>
        </div>
      </article>
    `
  );
}

function renderVerification(items) {
  renderCollection(
    "verification",
    items,
    (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.taskId)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <div class="tag-row">
          <span class="tag ${item.status === "failed" ? "warn" : ""}">${escapeHtml(item.status)}</span>
        </div>
      </article>
    `
  );
}

function renderRisks(risks) {
  renderCollection(
    "risks",
    risks,
    (risk) => `
      <article class="list-item">
        <h3>${escapeHtml(risk.level.toUpperCase())}</h3>
        <p>${escapeHtml(risk.message)}</p>
      </article>
    `
  );
}

function renderRuns(runs) {
  renderCollection(
    "runs",
    runs,
    (run) => `
      <article class="list-item">
        <h3>${escapeHtml(run.taskId)} - ${escapeHtml(run.status)}</h3>
        <p>${escapeHtml(run.summary)}</p>
        <p class="subtle">${escapeHtml(run.agent || "manual")} | ${escapeHtml(run.createdAt)}</p>
      </article>
    `
  );
}

function renderCollection(id, items, renderItem) {
  const container = document.getElementById(id);
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty">Nothing here yet.</div>';
    return;
  }

  container.innerHTML = items.map(renderItem).join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEditableDocumentConfig(documentName) {
  return EDITABLE_DOCUMENTS[documentName] || EDITABLE_DOCUMENTS["task.md"];
}

function populateRecipeSelect(selectId, recipes, selectedValue) {
  const select = document.getElementById(selectId);
  if (!select) {
    return;
  }

  select.innerHTML = (recipes || [])
    .map(
      (recipe) =>
        `<option value="${escapeHtml(recipe.id)}"${recipe.id === selectedValue ? " selected" : ""}>${escapeHtml(recipe.id)} - ${escapeHtml(recipe.name)}</option>`
    )
    .join("");
}

function populateDocumentEditor(detail) {
  const form = document.getElementById("document-editor-form");
  const taskIdInput = document.getElementById("document-task-id");
  const documentSelect = document.getElementById("document-name");
  const contentInput = document.getElementById("document-content");
  const note = document.getElementById("document-sync-note");
  const hasDetail = Boolean(detail && detail.meta);
  const config = getEditableDocumentConfig(activeDocumentName);

  taskIdInput.value = hasDetail ? detail.meta.id : "";
  documentSelect.value = activeDocumentName;
  contentInput.value = hasDetail ? detail[config.detailField] || "" : "";
  note.textContent = hasDetail ? config.note : "Select a task to edit its markdown bundle.";

  Array.from(form.elements).forEach((element) => {
    if (element.name !== "taskId") {
      element.disabled = !hasDetail;
    }
  });
}

function populateTaskForms(detail) {
  const hasDetail = Boolean(detail && detail.meta);
  const updateForm = document.getElementById("task-update-form");
  const runForm = document.getElementById("run-create-form");

  document.getElementById("selected-task-id").value = hasDetail ? detail.meta.id : "";
  document.getElementById("selected-task-title").value = hasDetail ? detail.meta.title || "" : "";
  document.getElementById("selected-task-status").value = hasDetail ? detail.meta.status || "todo" : "todo";
  document.getElementById("selected-task-priority").value = hasDetail ? detail.meta.priority || "P2" : "P2";
  document.getElementById("selected-task-recipe").value = hasDetail ? detail.meta.recipeId || "feature" : "feature";
  document.getElementById("run-task-id").value = hasDetail ? detail.meta.id : "";

  Array.from(updateForm.elements).forEach((element) => {
    if (element.name !== "taskId") {
      element.disabled = !hasDetail;
    }
  });
  Array.from(runForm.elements).forEach((element) => {
    if (element.name !== "taskId") {
      element.disabled = !hasDetail;
    }
  });

  populateDocumentEditor(detail);
}

function setActionStatus(message, tone) {
  const node = document.getElementById("action-status");
  node.textContent = message;
  node.className = "action-status";
  if (tone) {
    node.classList.add(tone);
  }
}

async function selectTask(taskId) {
  activeTaskId = taskId;
  renderTasks(window.__overview.tasks || []);
  renderTaskDetail(await loadTaskDetail(taskId));
}

async function refreshDashboard(nextTaskId) {
  const overview = await loadOverview();
  window.__overview = overview;
  document.getElementById("workspace-root").textContent = overview.workspaceRoot;
  renderStats(overview.stats);
  renderAdapters(overview.adapters || []);
  renderRecipes(overview.recipes || []);
  renderValidation(overview.validation || { ok: true, issues: [], errorCount: 0, warningCount: 0 });
  populateRecipeSelect("create-recipe", overview.recipes || [], document.getElementById("create-recipe").value || "feature");
  populateRecipeSelect("selected-task-recipe", overview.recipes || [], document.getElementById("selected-task-recipe").value || "feature");
  renderTasks(overview.tasks || []);
  renderMemory(overview.memory || []);
  renderVerification(overview.verification || []);
  renderRisks(overview.risks || []);
  renderRuns(overview.runs || []);

  if (overview.tasks && overview.tasks.length > 0) {
    activeTaskId =
      nextTaskId && overview.tasks.some((task) => task.id === nextTaskId)
        ? nextTaskId
        : activeTaskId && overview.tasks.some((task) => task.id === activeTaskId)
          ? activeTaskId
          : overview.tasks[0].id;
    renderTasks(overview.tasks || []);
    renderTaskDetail(await loadTaskDetail(activeTaskId));
  } else {
    activeTaskId = null;
    renderTaskDetail(null);
  }
}

function bindForms() {
  document.getElementById("document-name").addEventListener("change", (event) => {
    activeDocumentName = event.currentTarget.value || "task.md";
    populateDocumentEditor(activeTaskDetail);
  });

  document.getElementById("task-create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      setActionStatus("Creating task...", "");
      const payload = {
        taskId: String(formData.get("taskId") || "").trim(),
        title: String(formData.get("title") || "").trim(),
        priority: String(formData.get("priority") || "").trim(),
        recipeId: String(formData.get("recipeId") || "").trim(),
      };
      const task = await postJson("/api/tasks", payload);
      form.reset();
      document.getElementById("create-priority").value = "P2";
      document.getElementById("create-recipe").value = payload.recipeId || "feature";
      await refreshDashboard(task.id);
      setActionStatus(`Created task ${task.id}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });

  document.getElementById("task-update-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "").trim();
    if (!taskId) {
      setActionStatus("Select a task before updating it.", "error");
      return;
    }

    try {
      setActionStatus(`Saving task ${taskId}...`, "");
      await patchJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
        title: String(formData.get("title") || "").trim(),
        status: String(formData.get("status") || "").trim(),
        priority: String(formData.get("priority") || "").trim(),
        recipeId: String(formData.get("recipeId") || "").trim(),
      });
      await refreshDashboard(taskId);
      setActionStatus(`Updated task ${taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });

  document.getElementById("run-create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "").trim();
    if (!taskId) {
      setActionStatus("Select a task before recording run evidence.", "error");
      return;
    }

    try {
      setActionStatus(`Recording run for ${taskId}...`, "");
      await postJson(`/api/tasks/${encodeURIComponent(taskId)}/runs`, {
        agent: String(formData.get("agent") || "").trim(),
        status: String(formData.get("status") || "").trim(),
        summary: String(formData.get("summary") || "").trim(),
      });
      document.getElementById("run-summary").value = "";
      await refreshDashboard(taskId);
      setActionStatus(`Recorded run evidence for ${taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });

  document.getElementById("document-editor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "").trim();
    const documentName = String(formData.get("documentName") || "").trim() || "task.md";

    if (!taskId) {
      setActionStatus("Select a task before editing its markdown docs.", "error");
      return;
    }

    try {
      activeDocumentName = documentName;
      setActionStatus(`Saving ${documentName} for ${taskId}...`, "");
      const detail = await putJson(
        `/api/tasks/${encodeURIComponent(taskId)}/documents/${encodeURIComponent(documentName)}`,
        {
          content: String(formData.get("content") || ""),
        }
      );
      renderTaskDetail(detail);
      renderTasks(window.__overview.tasks || []);
      setActionStatus(`Saved ${documentName} for ${taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });
}

async function bootstrap() {
  try {
    const overview = await loadOverview();
    window.__overview = overview;
    document.getElementById("workspace-root").textContent = overview.workspaceRoot;
    populateRecipeSelect("create-recipe", overview.recipes || [], "feature");
    populateRecipeSelect("selected-task-recipe", overview.recipes || [], "feature");
    bindForms();
    await refreshDashboard();
    setActionStatus("Ready.", "");
  } catch (error) {
    document.getElementById("stats").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

bootstrap();
