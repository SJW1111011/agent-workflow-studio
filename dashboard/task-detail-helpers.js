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
          draftChecks: [],
          draftItems: [],
          verifiedItems: [],
        });
  const formatTimestampLabel =
    typeof executionHelpers.formatTimestampLabel === "function"
      ? executionHelpers.formatTimestampLabel
      : (value) => String(value || "No timestamp");
  const isVerificationGateWarning =
    typeof executionHelpers.isVerificationGateWarning === "function"
      ? executionHelpers.isVerificationGateWarning
      : (status) => status === "action-required" || status === "incomplete" || status === "unconfigured";
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

        <details class="collapsible-panel detail-card wide">
          <summary>Task Brief</summary>
          <div class="collapsible-body"><pre class="detail-pre">${escapeHtml(detail.taskText || "No task.md content.")}</pre></div>
        </details>

        <details class="collapsible-panel detail-card">
          <summary>Context</summary>
          <div class="collapsible-body"><pre class="detail-pre">${escapeHtml(detail.contextText || "No context.md content.")}</pre></div>
        </details>

        <details class="collapsible-panel detail-card">
          <summary>Verification</summary>
          <div class="collapsible-body"><pre class="detail-pre">${escapeHtml(detail.verificationText || "No verification.md content.")}</pre></div>
        </details>

        <details class="collapsible-panel detail-card">
          <summary>Checkpoint</summary>
          <div class="collapsible-body"><pre class="detail-pre">${escapeHtml(detail.checkpointText || "No checkpoint.md content.")}</pre></div>
        </details>

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
    const coverageView = describeVerificationCoverage(verificationGate);
    const proofSignals = describeVerificationProofSignals(verificationGate, verificationText);
    const draftChecks = proofSignals.draftChecks || proofSignals.plannedChecks || [];
    const draftItems = proofSignals.draftItems || proofSignals.weakItems || [];
    const verifiedItems = proofSignals.verifiedItems || proofSignals.strongItems || [];
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
    const plannedChecks = draftChecks.length
      ? draftChecks
          .map(
            (item) => `
              <article class="list-item proof-item-card proof-item-planned">
                <h3>${escapeHtml(item)}</h3>
                <p class="subtle">Draft checks are notes until they are backed by explicit files plus checks or artifacts.</p>
                <div class="tag-row">
                  <span class="tag">${escapeHtml("draft")}</span>
                </div>
              </article>
            `
          )
          .join("")
      : '<div class="empty">No draft checks recorded in verification.md.</div>';
    const weakProofItems = renderVerificationProofItems(
      draftItems,
      "draft",
      "Draft evidence still needs stronger check/result/artifact detail."
    );
    const strongProofItems = renderVerificationProofItems(
      verifiedItems,
      "verified",
      "No verified evidence recorded yet."
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
        <p class="status-banner-label">${escapeHtml("Evidence coverage")}</p>
        <div class="coverage-hero">
          <strong class="coverage-number">${escapeHtml(coverageView.badge)}</strong>
          <div class="coverage-copy">
            <h3>${escapeHtml(coverageView.title)}</h3>
            <p>${escapeHtml(summary.message || "No verification gate summary available.")}</p>
            <p class="subtle">${escapeHtml(coverageView.detail)}</p>
          </div>
        </div>
        ${renderCoverageBar(coverageView)}
        <p class="subtle">${escapeHtml(`Gate state: ${formatVerificationGateHeading(summary.status)}`)}</p>
        <div class="tag-row">
          <span class="tag ${isVerificationGateWarning(summary.status) ? "warn" : ""}">${escapeHtml(summary.status || "unknown")}</span>
          <span class="tag ${coverageView.warn ? "warn" : ""}">${escapeHtml(coverageView.tag)}</span>
          <span class="tag">${escapeHtml(`${summary.relevantChangeCount || 0} relevant change(s)`)}</span>
          <span class="tag">${escapeHtml(`${coverageView.scopedFileCount} scoped file(s)`)}</span>
          <span class="tag">${escapeHtml(`${scopeCoverage.hintCount || 0} scope hint(s)`)}</span>
          ${draftChecks.length > 0 ? `<span class="tag">${escapeHtml(`${draftChecks.length} draft check(s)`)}</span>` : ""}
          ${(scopeCoverage.ambiguousCount || 0) > 0 ? `<span class="tag warn">${escapeHtml(`${scopeCoverage.ambiguousCount} ambiguous`)}</span>` : ""}
          ${(verifiedItems.length > 0 || (proofCoverage.verifiedEvidenceCount || 0) > 0)
            ? `<span class="tag">${escapeHtml(`${verifiedItems.length || proofCoverage.verifiedEvidenceCount} verified item(s)`)}</span>`
            : ""}
          ${(draftItems.length > 0 || (proofCoverage.draftEvidenceCount || proofCoverage.weakProofCount || 0) > 0)
            ? `<span class="tag warn">${escapeHtml(`${draftItems.length || proofCoverage.draftEvidenceCount || proofCoverage.weakProofCount} draft evidence item(s)`)}</span>`
            : ""}
        </div>
        <p class="subtle">Latest run: ${escapeHtml(formatTimestampLabel(evidence.latestRunAt))}</p>
        <p class="subtle">Verification updated: ${escapeHtml(formatTimestampLabel(evidence.verificationUpdatedAt))}</p>
        <p class="subtle">Latest evidence: ${escapeHtml(formatTimestampLabel(evidence.latestEvidenceAt))}</p>
        <div class="verification-signal-grid">
          ${renderStatusBanner("Verification signal", proofSignals.presentation)}
          ${renderStatusBanner("Draft checks", {
            tone: draftChecks.length > 0 ? "draft" : "idle",
            headline: draftChecks.length > 0 ? `${draftChecks.length} draft check(s)` : "No draft checks",
            summary:
              draftChecks.length > 0
                ? "Draft checks are intent only; they do not satisfy the verification gate yet."
                : "No draft checks are currently recorded in verification.md.",
          })}
          ${renderStatusBanner("Draft evidence", {
            tone: draftItems.length > 0 ? "draft" : "idle",
            headline: draftItems.length > 0 ? `${draftItems.length} draft evidence item(s)` : "No draft evidence",
            summary:
              draftItems.length > 0
                ? "Draft evidence names files or intent, but still needs concrete checks, results, or artifact refs."
                : "No draft evidence placeholders are currently recorded.",
          })}
          ${renderStatusBanner("Verified evidence", {
            tone: verifiedItems.length > 0 ? "passed" : "idle",
            headline: verifiedItems.length > 0 ? `${verifiedItems.length} verified item(s)` : "No verified evidence",
            summary:
              verifiedItems.length > 0
                ? "Verified evidence ties repo-relative paths to checks or artifacts."
                : "No verified evidence items are currently recorded.",
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
        <h3>Draft Checks</h3>
        <div class="list">${plannedChecks}</div>
      </article>
      <article class="list-item">
        <h3>Draft Evidence</h3>
        <div class="list">${weakProofItems}</div>
      </article>
      <article class="list-item">
        <h3>Verified Evidence</h3>
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
              <span class="tag ${(item.verified || item.strong) ? "" : "warn"}">${escapeHtml(
                item.verified || item.strong ? "verified evidence" : "draft evidence"
              )}</span>
              ${
                item.verified || item.strong
                  ? `<span class="tag ${item.anchorCount > 0 ? "" : "warn"}">${escapeHtml(
                      item.anchorCount > 0 ? `${item.anchorCount} current match(es)` : "recorded-only"
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

  function describeVerificationCoverage(verificationGate) {
    const scopeCoverage = verificationGate && verificationGate.scopeCoverage ? verificationGate.scopeCoverage : {};
    const scopeHintCount = normalizeNonNegativeInteger(
      scopeCoverage.hintCount !== undefined
        ? scopeCoverage.hintCount
        : Array.isArray(verificationGate && verificationGate.scopeHints)
          ? verificationGate.scopeHints.length
          : 0
    );
    const scopedFileCount = normalizeNonNegativeInteger(
      scopeCoverage.scopedFileCount !== undefined
        ? scopeCoverage.scopedFileCount
        : verificationGate && verificationGate.repository && verificationGate.repository.scopedFileCount !== undefined
          ? verificationGate.repository.scopedFileCount
          : 0
    );
    const coveredFileCount = normalizeNonNegativeInteger(
      scopeCoverage.coveredFileCount !== undefined
        ? scopeCoverage.coveredFileCount
        : verificationGate && Array.isArray(verificationGate.coveredScopedFiles)
          ? verificationGate.coveredScopedFiles.length
          : 0
    );
    const coveragePercent = normalizeCoveragePercent(verificationGate && verificationGate.coveragePercent);

    if (scopeHintCount === 0) {
      return {
        badge: "No scope",
        title: "No scope defined",
        detail: "Add repo-relative scope paths to make evidence coverage automatic.",
        tag: "no scope defined",
        fillPercent: 0,
        scopedFileCount,
        coveredFileCount,
        showBar: false,
        warn: true,
      };
    }

    if (scopedFileCount === 0) {
      return {
        badge: "No files",
        title: "No scoped files matched",
        detail: "The current workspace has no files that match this task's declared scope yet.",
        tag: "no scoped files matched",
        fillPercent: 0,
        scopedFileCount,
        coveredFileCount,
        showBar: false,
        warn: false,
      };
    }

    return {
      badge: `${coveragePercent}%`,
      title: `${coveredFileCount}/${scopedFileCount} scoped file(s) covered`,
      detail:
        coveragePercent === 100
          ? "All scoped files are linked to verified evidence."
          : `${Math.max(scopedFileCount - coveredFileCount, 0)} scoped file(s) still need verified evidence.`,
      tag: `${coveragePercent}% covered`,
      fillPercent: coveragePercent,
      scopedFileCount,
      coveredFileCount,
      showBar: true,
      warn: coveragePercent < 100,
    };
  }

  function renderCoverageBar(coverageView) {
    if (!coverageView || !coverageView.showBar) {
      return "";
    }

    return `
      <div class="coverage-bar" aria-hidden="true">
        <span class="coverage-bar-fill ${coverageView.warn ? "coverage-bar-fill-warn" : ""}" style="width: ${escapeHtml(coverageView.fillPercent)}%"></span>
      </div>
    `;
  }

  function describeProofFreshnessModes(proofCoverage) {
    const anchoredStrongProofCount = Number(
      (proofCoverage && (proofCoverage.currentVerifiedEvidenceCount || proofCoverage.anchoredStrongProofCount)) || 0
    );
    const compatibilityStrongProofCount = Number(
      (proofCoverage && (proofCoverage.recordedVerifiedEvidenceCount || proofCoverage.compatibilityStrongProofCount)) || 0
    );

    if (anchoredStrongProofCount > 0 && compatibilityStrongProofCount > 0) {
      return {
        tone: "pending",
        headline: `${anchoredStrongProofCount} current, ${compatibilityStrongProofCount} recorded-only`,
        summary: "Some verified evidence is matched to current files, but some still relies on previously recorded verification details.",
      };
    }

    if (anchoredStrongProofCount > 0) {
      return {
        tone: "passed",
        headline: `${anchoredStrongProofCount} current verified item(s)`,
        summary: "Current freshness is being validated against the current repository snapshot.",
      };
    }

    if (compatibilityStrongProofCount > 0) {
      return {
        tone: "pending",
        headline: `${compatibilityStrongProofCount} recorded-only verified item(s)`,
        summary: "Verified evidence exists, but freshness still depends on earlier recorded details.",
      };
    }

    return {
      tone: "idle",
      headline: "No verified freshness mode yet",
      summary: "Add verified evidence first, then freshness can be compared against current files.",
    };
  }

  function formatVerificationGateHeading(status) {
    if (status === "action-required" || status === "needs-proof") {
      return "Action required";
    }

    if (status === "incomplete" || status === "partially-covered") {
      return "Coverage is incomplete";
    }

    if (status === "covered") {
      return "Scoped diff is covered";
    }

    if (status === "unconfigured" || status === "scope-missing") {
      return "Scope not configured";
    }

    if (status === "unavailable") {
      return "Diff-aware gate unavailable";
    }

    return "No extra evidence required";
  }

  function renderChangeMatchSummary(changedFile) {
    const matchedBy = (changedFile.matchedBy || []).map((hint) => `${hint.pattern} (${hint.source})`);
    if (matchedBy.length === 0) {
      return "Matched by no scope hints.";
    }

    return `Matched by ${matchedBy.join(", ")}${changedFile.previousPath ? `; previous path ${changedFile.previousPath}` : ""}`;
  }

  function renderProofFreshnessSourceTag(source) {
    if (source === "current" || source === "anchor-backed") {
      return '<span class="tag">current</span>';
    }

    if (source === "recorded" || source === "compatibility-only") {
      return '<span class="tag warn">recorded-only</span>';
    }

    if (source === "outdated" || source === "anchor-stale") {
      return '<span class="tag warn">outdated</span>';
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

  function normalizeCoveragePercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function normalizeNonNegativeInteger(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }

    return Math.round(numeric);
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
