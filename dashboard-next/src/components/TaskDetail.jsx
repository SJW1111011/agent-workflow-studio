import ExecutionPanel from "./ExecutionPanel.jsx";
import { useDashboardContext } from "../context/DashboardContext.jsx";
import {
  describeRunPresentation,
  formatTimestampLabel,
  formatVerificationGateLabel,
  isVerificationGateWarning,
} from "../utils/execution.js";
import { describeVerificationProofSignals } from "../utils/document.js";

function EvidenceList({ emptyMessage, items, renderItem }) {
  if (!items.length) {
    return <div className="empty">{emptyMessage}</div>;
  }

  return items.map(renderItem);
}

function RunLogPanel({ entry }) {
  if (!entry || entry.status === "loading") {
    return <p className="subtle">Loading log...</p>;
  }

  if (entry.status === "error") {
    return <div className="empty">{entry.error || "Unable to load log output."}</div>;
  }

  if (!entry.data) {
    return <div className="empty">No log content is available.</div>;
  }

  const log = entry.data;
  return (
    <>
      <p className="subtle">Log path: {log.path}</p>
      {log.truncated ? <p className="subtle">{`Showing last ${log.content.length} of ${log.size} chars.`}</p> : null}
      <pre className="detail-pre">{log.content || "(empty log)"}</pre>
    </>
  );
}

function RunCard({ run, taskId }) {
  const { state, toggleRunLog } = useDashboardContext();
  const presentation = describeRunPresentation(run);
  const stdoutKey = `${run.id}:stdout`;
  const stderrKey = `${run.id}:stderr`;
  const stdoutLog = state.logState.runLogs[stdoutKey];
  const stderrLog = state.logState.runLogs[stderrKey];

  return (
    <article className={`list-item execution-state-card execution-tone-${presentation.tone}`}>
      <h3>{run.id}</h3>
      <p>{presentation.summary}</p>
      <div className="tag-row">
        <span className={presentation.warn ? "tag warn" : "tag"}>{run.status || "recorded"}</span>
        <span className="tag">{run.agent || "manual"}</span>
        <span className="tag">{formatTimestampLabel(run.createdAt)}</span>
      </div>
      {presentation.detail ? <p className="subtle">{presentation.detail}</p> : null}
      {Array.isArray(run.scopeProofPaths) && run.scopeProofPaths.length > 0 ? (
        <p className="subtle">Files: {run.scopeProofPaths.join(", ")}</p>
      ) : null}
      {Array.isArray(run.verificationChecks) && run.verificationChecks.length > 0 ? (
        <ul className="editor-guidance-list">
          {run.verificationChecks.map((check, index) => (
            <li key={`${run.id}:check:${index}`}>
              {`[${check.status || "recorded"}] ${check.label}`}
              {check.details ? ` - ${check.details}` : ""}
              {Array.isArray(check.artifacts) && check.artifacts.length > 0
                ? ` | artifacts: ${check.artifacts.join(", ")}`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {Array.isArray(run.verificationArtifacts) && run.verificationArtifacts.length > 0 ? (
        <p className="subtle">Artifacts: {run.verificationArtifacts.join(", ")}</p>
      ) : null}
      {run.stdoutFile || run.stderrFile ? (
        <div className="form-inline-actions">
          {run.stdoutFile ? (
            <button
              className="secondary-button log-button"
              onClick={() => toggleRunLog(taskId, run.id, "stdout")}
              type="button"
            >
              {stdoutLog?.open ? "Hide stdout" : "View stdout"}
            </button>
          ) : null}
          {run.stderrFile ? (
            <button
              className="secondary-button log-button"
              onClick={() => toggleRunLog(taskId, run.id, "stderr")}
              type="button"
            >
              {stderrLog?.open ? "Hide stderr" : "View stderr"}
            </button>
          ) : null}
        </div>
      ) : null}
      {stdoutLog?.open ? (
        <div className="run-log-panel">
          <RunLogPanel entry={stdoutLog} />
        </div>
      ) : null}
      {stderrLog?.open ? (
        <div className="run-log-panel">
          <RunLogPanel entry={stderrLog} />
        </div>
      ) : null}
    </article>
  );
}

function ProofItem({ item, variant }) {
  return (
    <article className="list-item">
      <h3>{item.sourceLabel || `${variant} evidence`}</h3>
      <p className="subtle">{item.recordedAt ? formatTimestampLabel(item.recordedAt) : "No timestamp recorded."}</p>
      <div className="tag-row">
        <span className={variant === "verified" ? "tag" : "tag warn"}>{item.sourceType || variant}</span>
      </div>
      {Array.isArray(item.paths) && item.paths.length > 0 ? <p>Files: {item.paths.join(", ")}</p> : null}
      {Array.isArray(item.checks) && item.checks.length > 0 ? (
        <ul className="editor-guidance-list">
          {item.checks.map((check, index) => (
            <li key={`${item.sourceLabel || variant}:check:${index}`}>{check}</li>
          ))}
        </ul>
      ) : null}
      {Array.isArray(item.artifacts) && item.artifacts.length > 0 ? (
        <p className="subtle">Artifacts: {item.artifacts.join(", ")}</p>
      ) : null}
    </article>
  );
}

export default function TaskDetail({ hidden }) {
  const { state } = useDashboardContext();
  const detail = state.taskDetail.data;

  return (
    <section className={hidden ? "panel panel-wide tab-hidden" : "panel panel-wide"} data-tab="tasks">
      <div className="panel-head">
        <div>
          <h2>Task Detail</h2>
          <p>Live detail for the selected task, including raw docs, generated files, verification state, and execution logs.</p>
        </div>
      </div>

      {!detail?.meta?.id ? (
        <div className="empty">
          {state.taskDetail.status === "loading" ? "Loading task detail..." : "Select a task to inspect its detail bundle."}
        </div>
      ) : (
        <div className="detail-grid">
          <article className="detail-card">
            <h3>
              {detail.meta.id} - {detail.meta.title}
            </h3>
            <p className="subtle">
              Priority {detail.meta.priority || "P2"} | Status {detail.meta.status || "todo"}
            </p>
            <div className="tag-row">
              <span className="tag">{detail.recipe?.id || detail.meta.recipeId || "feature"}</span>
              <span className="tag">{detail.recipe?.name || "Unknown recipe"}</span>
              <span className="tag">{formatTimestampLabel(detail.meta.updatedAt)}</span>
            </div>
            <p>{detail.recipe?.summary || "No recipe summary available."}</p>
          </article>

          <article className="detail-card">
            <h3>Generated Files</h3>
            <div className="list">
              <EvidenceList
                emptyMessage="No generated files tracked yet."
                items={detail.generatedFiles || []}
                renderItem={(item) => (
                  <article className="list-item" key={item.name}>
                    <h3>{item.name}</h3>
                    <div className="tag-row">
                      <span className={item.exists ? "tag" : "tag warn"}>{item.exists ? "Generated" : "Missing"}</span>
                    </div>
                  </article>
                )}
              />
            </div>
          </article>

          <details className="collapsible-panel detail-card wide">
            <summary>Task Brief</summary>
            <div className="collapsible-body">
              <pre className="detail-pre">{detail.taskText || "No task.md content."}</pre>
            </div>
          </details>

          <details className="collapsible-panel detail-card">
            <summary>Context</summary>
            <div className="collapsible-body">
              <pre className="detail-pre">{detail.contextText || "No context.md content."}</pre>
            </div>
          </details>

          <details className="collapsible-panel detail-card">
            <summary>Verification</summary>
            <div className="collapsible-body">
              <pre className="detail-pre">{detail.verificationText || "No verification.md content."}</pre>
            </div>
          </details>

          <details className="collapsible-panel detail-card">
            <summary>Checkpoint</summary>
            <div className="collapsible-body">
              <pre className="detail-pre">{detail.checkpointText || "No checkpoint.md content."}</pre>
            </div>
          </details>

          <article className="detail-card">
            <h3>Runs</h3>
            <div className="list">
              <EvidenceList
                emptyMessage="No runs recorded yet."
                items={detail.runs || []}
                renderItem={(run) => <RunCard key={run.id} run={run} taskId={detail.meta.id} />}
              />
            </div>
          </article>

          <article className="detail-card">
            <h3>Execution Bridge</h3>
            <ExecutionPanel detail={detail} />
          </article>

          <article className="detail-card">
            <h3>Schema Issues</h3>
            <div className="list">
              <EvidenceList
                emptyMessage="No task-level schema issues detected."
                items={detail.schemaIssues || []}
                renderItem={(issue, index) => (
                  <article className="list-item" key={`${issue.code || "issue"}:${index}`}>
                    <h3>
                      {String(issue.level || "info").toUpperCase()} - {issue.code || "validation"}
                    </h3>
                    <p>{issue.message || "Schema issue reported."}</p>
                    <p className="subtle">{issue.target || "No target recorded."}</p>
                  </article>
                )}
              />
            </div>
          </article>

          <article className="detail-card">
            <h3>Freshness</h3>
            <div className="list">
              <article className="list-item">
                <h3>{detail.freshness?.summary?.status === "stale" ? "Needs refresh" : "Looks current"}</h3>
                <p>{detail.freshness?.summary?.message || "No freshness summary available."}</p>
                <div className="tag-row">
                  <span className={detail.freshness?.summary?.status === "stale" ? "tag warn" : "tag"}>
                    {detail.freshness?.summary?.status || "unknown"}
                  </span>
                  <span className="tag">{`${detail.freshness?.summary?.staleCount || 0} stale doc(s)`}</span>
                </div>
              </article>
              {(detail.freshness?.docs || []).map((doc) => (
                <article className="list-item" key={doc.relativePath || doc.name}>
                  <h3>{doc.name}</h3>
                  <p>{doc.reason || "No freshness note available."}</p>
                  <p className="subtle">{doc.relativePath || "Unknown path"}</p>
                  <div className="tag-row">
                    <span className={doc.status === "fresh" ? "tag" : "tag warn"}>{doc.status || "unknown"}</span>
                    <span className="tag">{formatTimestampLabel(doc.modifiedAt)}</span>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="detail-card wide">
            <h3>Verification Gate</h3>
            {detail.verificationGate?.summary ? (
              <div className="list">
                <article className="status-banner status-banner-running">
                  <p className="status-banner-label">Gate status</p>
                  <h4>
                    {formatVerificationGateLabel(
                      detail.verificationGate.summary.status,
                      detail.verificationGate.summary.relevantChangeCount || 0
                    )}
                  </h4>
                  <p>{detail.verificationGate.summary.message || "No gate summary available."}</p>
                </article>

                <article className="list-item">
                  <h3>Coverage</h3>
                  <p>
                    {detail.verificationGate.coveragePercent || 0}% | {detail.verificationGate.scopeCoverage?.coveredFileCount || 0} covered of{" "}
                    {detail.verificationGate.scopeCoverage?.scopedFileCount || 0} scoped files
                  </p>
                  <div className="tag-row">
                    <span
                      className={
                        isVerificationGateWarning(detail.verificationGate.summary.status) ? "tag warn" : "tag"
                      }
                    >
                      {detail.verificationGate.summary.status}
                    </span>
                    <span className="tag">{detail.verificationGate.scopeCoverage?.hintCount || 0} scope hints</span>
                    <span className="tag">{detail.verificationGate.summary.relevantChangeCount || 0} relevant changes</span>
                  </div>
                </article>

                <article className="list-item">
                  <h3>Scope Hints</h3>
                  {(detail.verificationGate.scopeHints || []).length === 0 ? (
                    <p className="subtle">No repo-relative scope hints found yet.</p>
                  ) : (
                    <ul className="editor-guidance-list">
                      {detail.verificationGate.scopeHints.map((hint, index) => (
                        <li key={`${hint.pattern}:${index}`}>{`${hint.pattern} (${hint.source})`}</li>
                      ))}
                    </ul>
                  )}
                </article>

                <article className="list-item">
                  <h3>Relevant Changes</h3>
                  {(detail.verificationGate.relevantChangedFiles || []).length === 0 ? (
                    <p className="subtle">No relevant changed files are currently matched.</p>
                  ) : (
                    <ul className="editor-guidance-list">
                      {detail.verificationGate.relevantChangedFiles.map((file, index) => (
                        <li key={`${file.path}:${index}`}>{file.path}</li>
                      ))}
                    </ul>
                  )}
                </article>

                {(() => {
                  const signals = describeVerificationProofSignals(detail.verificationGate, detail.verificationText);

                  return (
                    <>
                      <article className="list-item">
                        <h3>Proof Signals</h3>
                        <p>{signals.presentation?.summary || "No proof-signal summary available."}</p>
                        <div className="tag-row">
                          <span className={signals.presentation?.warn ? "tag warn" : "tag"}>
                            {signals.presentation?.headline || "Proof status"}
                          </span>
                          <span className="tag">{(signals.verifiedItems || []).length} verified item(s)</span>
                          <span className="tag">{(signals.draftItems || []).length} draft item(s)</span>
                          <span className="tag">{(signals.draftChecks || []).length} draft check(s)</span>
                        </div>
                      </article>

                      <article className="list-item">
                        <h3>Draft Checks</h3>
                        {(signals.draftChecks || []).length === 0 ? (
                          <p className="subtle">No draft checks recorded.</p>
                        ) : (
                          <ul className="editor-guidance-list">
                            {(signals.draftChecks || []).map((check, index) => (
                              <li key={`draft-check:${index}`}>{check}</li>
                            ))}
                          </ul>
                        )}
                      </article>

                      <article className="list-item">
                        <h3>Verified Evidence</h3>
                        <div className="list">
                          <EvidenceList
                            emptyMessage="No verified evidence items recorded."
                            items={signals.verifiedItems || []}
                            renderItem={(item, index) => <ProofItem item={item} key={`verified:${index}`} variant="verified" />}
                          />
                        </div>
                      </article>

                      <article className="list-item">
                        <h3>Draft Evidence</h3>
                        <div className="list">
                          <EvidenceList
                            emptyMessage="No draft-only evidence items recorded."
                            items={signals.draftItems || []}
                            renderItem={(item, index) => <ProofItem item={item} key={`draft:${index}`} variant="draft" />}
                          />
                        </div>
                      </article>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="empty">No verification gate data available.</div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
