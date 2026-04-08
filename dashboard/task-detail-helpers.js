(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory({
      documentHelpers: require("./document-helpers.js"),
      executionHelpers: require("./execution-detail-helpers.js"),
    });
    return;
  }

  root.AgentWorkflowDashboardTaskDetailHelpers = factory({
    documentHelpers: root.AgentWorkflowDashboardDocumentHelpers,
    executionHelpers: root.AgentWorkflowDashboardExecutionDetailHelpers,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, ({ documentHelpers = {}, executionHelpers = {} } = {}) => {
  const describeVerificationProofSignals =
    typeof documentHelpers.describeVerificationProofSignals === "function"
      ? documentHelpers.describeVerificationProofSignals
      : () => ({
          presentation: {
            tone: "idle",
            headline: "Verification helpers unavailable",
            summary: "Verification proof signals could not be derived in this environment.",
          },
          plannedChecks: [],
          weakItems: [],
          strongItems: [],
        });
  const formatTimestampLabel =
    typeof executionHelpers.formatTimestampLabel === "function"
      ? executionHelpers.formatTimestampLabel
      : (value) => String(value || "No timestamp");
  const isVerificationGateWarning =
    typeof executionHelpers.isVerificationGateWarning === "function"
      ? executionHelpers.isVerificationGateWarning
      : (status) => status === "needs-proof" || status === "partially-covered" || status === "scope-missing";
  const renderExecutionStateMarkup =
    typeof executionHelpers.renderExecutionStateMarkup === "function"
      ? executionHelpers.renderExecutionStateMarkup
      : () => '<div class="empty">Execution rendering is unavailable.</div>';
  const renderStatusBanner =
    typeof executionHelpers.renderStatusBanner === "function"
      ? executionHelpers.renderStatusBanner
      : renderStatusBannerFallback;
  const renderTaskRun =
    typeof executionHelpers.renderTaskRun === "function"
      ? executionHelpers.renderTaskRun
      : () => '<div class="empty">Run rendering is unavailable.</div>';

  function renderTaskDetailMarkup(detail, uiState = {}) {
    if (!detail || !detail.meta) {
      return '<div class="empty">Select a task to inspect its detail bundle.</div>';
    }

    const generatedFiles = renderGeneratedFiles(detail.generatedFiles);
    const schemaIssues = renderSchemaIssues(detail.schemaIssues);
    const runItems = renderTaskRuns(detail.runs, detail.meta.id);
    const freshnessItems = renderTaskFreshness(detail.freshness);
    const verificationGateItems = renderVerificationGate(detail.verificationGate, detail.verificationText);

    return `
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
          <h3>Checkpoint</h3>
          <pre class="detail-pre">${escapeHtml(detail.checkpointText || "No checkpoint.md content.")}</pre>
        </article>

        <article class="detail-card">
          <h3>Runs</h3>
          <div class="list">${runItems}</div>
        </article>

        <article class="detail-card">
          <h3>Execution Bridge</h3>
          <div class="list" id="task-execution-state-panel">${renderExecutionStateMarkup(detail.executionState, uiState)}</div>
        </article>

        <article class="detail-card">
          <h3>Schema Issues</h3>
          <div class="list">${schemaIssues}</div>
        </article>

        <article class="detail-card">
          <h3>Freshness</h3>
          <div class="list">${freshnessItems}</div>
        </article>

        <article class="detail-card">
          <h3>Verification Gate</h3>
          <div class="list">${verificationGateItems}</div>
        </article>
      </div>
    `;
  }

  function renderGeneratedFiles(generatedFiles) {
    const entries = Array.isArray(generatedFiles) ? generatedFiles : [];
    if (entries.length === 0) {
      return '<div class="empty">No generated files tracked yet.</div>';
    }

    return entries
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
  }

  function renderSchemaIssues(schemaIssues) {
    const entries = Array.isArray(schemaIssues) ? schemaIssues : [];
    if (entries.length === 0) {
      return '<div class="empty">No task-level schema issues detected.</div>';
    }

    return entries
      .map(
        (issue) => `
          <article class="list-item">
            <h3>${escapeHtml(String(issue.level || "").toUpperCase())} - ${escapeHtml(issue.code)}</h3>
            <p>${escapeHtml(issue.message)}</p>
            <p class="subtle">${escapeHtml(issue.target)}</p>
          </article>
        `
      )
      .join("");
  }

  function renderTaskRuns(runs, taskId) {
    const entries = Array.isArray(runs) ? runs : [];
    if (entries.length === 0) {
      return '<div class="empty">No runs recorded yet.</div>';
    }

    return entries.map((run) => renderTaskRun(run, taskId)).join("");
  }

  function renderTaskFreshness(freshness) {
    if (!freshness || !Array.isArray(freshness.docs) || freshness.docs.length === 0) {
      return '<div class="empty">No freshness data available.</div>';
    }

    const summary = freshness.summary || {};
    const items = freshness.docs
      .map(
        (doc) => `
          <article class="list-item">
            <h3>${escapeHtml(doc.name)}</h3>
            <p>${escapeHtml(doc.reason || "No freshness note available.")}</p>
            <p class="subtle">${escapeHtml(doc.relativePath || "Unknown path")}</p>
            <div class="tag-row">
              <span class="tag ${doc.status !== "fresh" ? "warn" : ""}">${escapeHtml(doc.status || "unknown")}</span>
              <span class="tag">${escapeHtml(formatTimestampLabel(doc.modifiedAt))}</span>
            </div>
          </article>
        `
      )
      .join("");

    return `
      <article class="list-item">
        <h3>${escapeHtml(summary.status === "stale" ? "Needs refresh" : "Looks current")}</h3>
        <p>${escapeHtml(summary.message || "No summary available.")}</p>
        <div class="tag-row">
          <span class="tag ${summary.status === "stale" ? "warn" : ""}">${escapeHtml(summary.status || "unknown")}</span>
          <span class="tag">${escapeHtml(`${summary.staleCount || 0} stale doc(s)`)}</span>
        </div>
      </article>
      ${items}
    `;
  }

  function renderVerificationGate(verificationGate, verificationText = "") {
    if (!verificationGate || !verificationGate.summary) {
      return '<div class="empty">No verification gate data available.</div>';
    }

    const summary = verificationGate.summary;
    const scopeCoverage = verificationGate.scopeCoverage || {};
    const proofCoverage = verificationGate.proofCoverage || {};
    const proofSignals = describeVerificationProofSignals(verificationGate, verificationText);
    const proofFreshness = describeProofFreshnessModes(proofCoverage);
    const scopeHints = (verificationGate.scopeHints || []).length
      ? (verificationGate.scopeHints || [])
          .map(
            (hint) => `
              <article class="list-item">
                <h3>${escapeHtml(hint.pattern)}</h3>
                <p class="subtle">Declared in ${escapeHtml(hint.source)}</p>
              </article>
            `
          )
          .join("")
      : '<div class="empty">No repo-relative scope hints found yet.</div>';

    const changedFiles = (verificationGate.relevantChangedFiles || []).length
      ? (verificationGate.relevantChangedFiles || [])
          .map(
            (changedFile) => `
              <article class="list-item">
                <h3>${escapeHtml(changedFile.path)}</h3>
                <p>${escapeHtml(renderChangeMatchSummary(changedFile))}</p>
                <div class="tag-row">
                  <span class="tag ${changedFile.changeType === "deleted" ? "warn" : ""}">${escapeHtml(changedFile.changeType)}</span>
                  ${changedFile.gitState ? `<span class="tag">${escapeHtml(changedFile.gitState)}</span>` : ""}
                  ${renderProofFreshnessSourceTag(changedFile.proofFreshnessSource)}
                  <span class="tag">${escapeHtml(formatTimestampLabel(changedFile.modifiedAt))}</span>
                </div>
              </article>
            `
          )
          .join("")
      : '<div class="empty">No current local changes match this task scope.</div>';
    const coveredFiles = (verificationGate.coveredScopedFiles || []).length
      ? (verificationGate.coveredScopedFiles || [])
          .map(
            (coveredFile) => `
              <article class="list-item">
                <h3>${escapeHtml(coveredFile.path)}</h3>
                <p>${escapeHtml(renderChangeMatchSummary(coveredFile))}</p>
                <div class="tag-row">
                  <span class="tag">${escapeHtml("covered")}</span>
                  ${renderProofFreshnessSourceTag(coveredFile.proofFreshnessSource)}
                  <span class="tag">${escapeHtml(formatTimestampLabel(coveredFile.proofUpdatedAt))}</span>
                </div>
              </article>
            `
          )
          .join("")
      : '<div class="empty">No scoped files are explicitly linked to proof yet.</div>';
    const plannedChecks = proofSignals.plannedChecks.length
      ? proofSignals.plannedChecks
          .map(
            (item) => `
              <article class="list-item proof-item-card proof-item-planned">
                <h3>${escapeHtml(item)}</h3>
                <p class="subtle">Planned checks are notes until they are backed by explicit proof paths plus checks or artifacts.</p>
                <div class="tag-row">
                  <span class="tag">${escapeHtml("planned")}</span>
                </div>
              </article>
            `
          )
          .join("")
      : '<div class="empty">No planned checks recorded in verification.md.</div>';
    const weakProofItems = renderVerificationProofItems(
      proofSignals.weakItems,
      "draft",
      "Draft proof still needs stronger check/result/artifact detail."
    );
    const strongProofItems = renderVerificationProofItems(
      proofSignals.strongItems,
      "strong",
      "No strong proof items recorded yet."
    );
    const ambiguousScopeEntries = (scopeCoverage.ambiguousEntries || []).length
      ? (scopeCoverage.ambiguousEntries || [])
          .map(
            (entry) => `
              <article class="list-item">
                <h3>${escapeHtml(entry.value)}</h3>
                <p class="subtle">Needs a tighter repo-relative path in ${escapeHtml(entry.source)}</p>
              </article>
            `
          )
          .join("")
      : '<div class="empty">No ambiguous scope entries detected.</div>';

    const evidence = verificationGate.evidence || {};

    return `
      <article class="list-item">
        <h3>${escapeHtml(formatVerificationGateHeading(summary.status))}</h3>
        <p>${escapeHtml(summary.message || "No verification gate summary available.")}</p>
        <div class="tag-row">
          <span class="tag ${isVerificationGateWarning(summary.status) ? "warn" : ""}">${escapeHtml(summary.status || "unknown")}</span>
          <span class="tag">${escapeHtml(`${summary.relevantChangeCount || 0} relevant change(s)`)}</span>
          <span class="tag">${escapeHtml(`${(verificationGate.repository && verificationGate.repository.scopedFileCount) || 0} scoped file(s)`)}</span>
          <span class="tag">${escapeHtml(`${scopeCoverage.hintCount || 0} scope hint(s)`)}</span>
          ${proofSignals.plannedChecks.length > 0 ? `<span class="tag">${escapeHtml(`${proofSignals.plannedChecks.length} planned check(s)`)}</span>` : ""}
          ${(scopeCoverage.ambiguousCount || 0) > 0 ? `<span class="tag warn">${escapeHtml(`${scopeCoverage.ambiguousCount} ambiguous`)}</span>` : ""}
          ${(proofCoverage.explicitProofCount || 0) > 0 ? `<span class="tag">${escapeHtml(`${proofCoverage.explicitProofCount} explicit proof item(s)`)}</span>` : ""}
          ${(proofCoverage.weakProofCount || 0) > 0 ? `<span class="tag warn">${escapeHtml(`${proofCoverage.weakProofCount} weak proof item(s)`)}</span>` : ""}
        </div>
        <p class="subtle">Latest run: ${escapeHtml(formatTimestampLabel(evidence.latestRunAt))}</p>
        <p class="subtle">Verification updated: ${escapeHtml(formatTimestampLabel(evidence.verificationUpdatedAt))}</p>
        <p class="subtle">Latest evidence: ${escapeHtml(formatTimestampLabel(evidence.latestEvidenceAt))}</p>
        <div class="verification-signal-grid">
          ${renderStatusBanner("Verification signal", proofSignals.presentation)}
          ${renderStatusBanner("Planned checks", {
            tone: proofSignals.plannedChecks.length > 0 ? "pending" : "idle",
            headline: proofSignals.plannedChecks.length > 0 ? `${proofSignals.plannedChecks.length} planned check(s)` : "No planned checks",
            summary:
              proofSignals.plannedChecks.length > 0
                ? "Planned checks are intent only; they do not satisfy the verification gate."
                : "No planned checks are currently recorded in verification.md.",
          })}
          ${renderStatusBanner("Draft proof", {
            tone: proofSignals.weakItems.length > 0 ? "draft" : "idle",
            headline: proofSignals.weakItems.length > 0 ? `${proofSignals.weakItems.length} draft proof item(s)` : "No draft proof",
            summary:
              proofSignals.weakItems.length > 0
                ? "Draft proof names files or intent, but still needs concrete checks, results, or artifact refs."
                : "No weak proof placeholders are currently recorded.",
          })}
          ${renderStatusBanner("Strong proof", {
            tone: proofSignals.strongItems.length > 0 ? "passed" : "idle",
            headline: proofSignals.strongItems.length > 0 ? `${proofSignals.strongItems.length} strong proof item(s)` : "No strong proof",
            summary:
              proofSignals.strongItems.length > 0
                ? "Strong proof ties repo-relative paths to checks or artifacts."
                : "No strong proof items are currently recorded.",
          })}
          ${renderStatusBanner("Proof freshness", proofFreshness)}
        </div>
      </article>
      <article class="list-item">
        <h3>Scope Hints</h3>
        <div class="list">${scopeHints}</div>
      </article>
      <article class="list-item">
        <h3>Relevant Changed Files</h3>
        <div class="list">${changedFiles}</div>
      </article>
      <article class="list-item">
        <h3>Covered Scoped Files</h3>
        <div class="list">${coveredFiles}</div>
      </article>
      <article class="list-item">
        <h3>Planned Checks</h3>
        <div class="list">${plannedChecks}</div>
      </article>
      <article class="list-item">
        <h3>Draft / Weak Proof</h3>
        <div class="list">${weakProofItems}</div>
      </article>
      <article class="list-item">
        <h3>Strong Proof</h3>
        <div class="list">${strongProofItems}</div>
      </article>
      <article class="list-item">
        <h3>Scope Entries To Tighten</h3>
        <div class="list">${ambiguousScopeEntries}</div>
      </article>
    `;
  }

  function renderVerificationProofItems(items, variant, emptyMessage) {
    const entries = Array.isArray(items) ? items : [];
    if (entries.length === 0) {
      return `<div class="empty">${escapeHtml(emptyMessage)}</div>`;
    }

    return entries
      .map(
        (item) => `
          <article class="list-item proof-item-card proof-item-${escapeHtml(variant)}">
            <h3>${escapeHtml(`${item.sourceType}:${item.sourceLabel}`)}</h3>
            <p>${escapeHtml(item.checks && item.checks.length > 0 ? item.checks.join("; ") : "No explicit check text recorded.")}</p>
            <p class="subtle">${escapeHtml(item.paths && item.paths.length > 0 ? item.paths.join(", ") : "No proof paths recorded.")}</p>
            <p class="subtle">${escapeHtml(item.artifacts && item.artifacts.length > 0 ? item.artifacts.join(", ") : "No artifact refs recorded.")}</p>
            <div class="tag-row">
              <span class="tag ${item.strong ? "" : "warn"}">${escapeHtml(item.strong ? "strong proof" : "weak proof")}</span>
              ${
                item.strong
                  ? `<span class="tag ${item.anchorCount > 0 ? "" : "warn"}">${escapeHtml(
                      item.anchorCount > 0 ? `${item.anchorCount} anchor(s)` : "compatibility-only"
                    )}</span>`
                  : ""
              }
              <span class="tag">${escapeHtml(formatTimestampLabel(item.recordedAt))}</span>
            </div>
          </article>
        `
      )
      .join("");
  }

  function describeProofFreshnessModes(proofCoverage) {
    const anchoredStrongProofCount = Number((proofCoverage && proofCoverage.anchoredStrongProofCount) || 0);
    const compatibilityStrongProofCount = Number((proofCoverage && proofCoverage.compatibilityStrongProofCount) || 0);

    if (anchoredStrongProofCount > 0 && compatibilityStrongProofCount > 0) {
      return {
        tone: "pending",
        headline: `${anchoredStrongProofCount} anchor-backed, ${compatibilityStrongProofCount} compatibility-only`,
        summary: "Some strong proof is content-anchored, but some still relies on compatibility timestamps rather than matching fingerprints.",
      };
    }

    if (anchoredStrongProofCount > 0) {
      return {
        tone: "passed",
        headline: `${anchoredStrongProofCount} anchor-backed strong proof item(s)`,
        summary: "Current freshness is being validated by matching proof anchors against the current repository snapshot.",
      };
    }

    if (compatibilityStrongProofCount > 0) {
      return {
        tone: "pending",
        headline: `${compatibilityStrongProofCount} compatibility-only strong proof item(s)`,
        summary: "Strong proof exists, but freshness still depends on recorded time rather than matching proof anchors.",
      };
    }

    return {
      tone: "idle",
      headline: "No strong proof freshness mode yet",
      summary: "Add strong proof first, then anchors can harden freshness beyond compatibility timestamps.",
    };
  }

  function formatVerificationGateHeading(status) {
    if (status === "needs-proof") {
      return "Explicit proof needed";
    }

    if (status === "partially-covered") {
      return "Proof is only partial";
    }

    if (status === "covered") {
      return "Scoped diff is covered";
    }

    if (status === "scope-missing") {
      return "Scope hints missing";
    }

    if (status === "unavailable") {
      return "Diff-aware gate unavailable";
    }

    return "No extra proof required";
  }

  function renderChangeMatchSummary(changedFile) {
    const matchedBy = (changedFile.matchedBy || []).map((hint) => `${hint.pattern} (${hint.source})`);
    if (matchedBy.length === 0) {
      return "Matched by no scope hints.";
    }

    return `Matched by ${matchedBy.join(", ")}${changedFile.previousPath ? `; previous path ${changedFile.previousPath}` : ""}`;
  }

  function renderProofFreshnessSourceTag(source) {
    if (source === "anchor-backed") {
      return '<span class="tag">anchor-backed</span>';
    }

    if (source === "compatibility-only") {
      return '<span class="tag warn">compatibility-only</span>';
    }

    if (source === "anchor-stale") {
      return '<span class="tag warn">anchor stale</span>';
    }

    return "";
  }

  function renderStatusBannerFallback(label, presentation) {
    const view = presentation && typeof presentation === "object" ? presentation : {};
    const tone = normalizeTone(view.tone);
    const headline = view.headline || "Recorded";
    const summary = view.summary || "";

    return `
      <div class="status-banner status-banner-${escapeHtml(tone)}">
        <p class="status-banner-label">${escapeHtml(label)}</p>
        <h4>${escapeHtml(headline)}</h4>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
      </div>
    `;
  }

  function normalizeTone(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "timed out") {
      return "timed-out";
    }
    if (normalized === "cancel requested") {
      return "cancel-requested";
    }
    if (normalized === "failed to start") {
      return "failed";
    }
    return normalized || "idle";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return {
    formatVerificationGateHeading,
    renderChangeMatchSummary,
    renderTaskDetailMarkup,
    renderTaskFreshness,
    renderVerificationGate,
    renderVerificationProofItems,
  };
});
