import { useState } from "preact/hooks";
import { useDashboardContext } from "../context/DashboardContext.jsx";
import { formatTimestampLabel } from "../utils/execution.js";

function normalizeReviewStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "approved" || normalized === "rejected"
    ? normalized
    : null;
}

function getReviewBadge(meta) {
  const reviewStatus = normalizeReviewStatus(meta && meta.reviewStatus);

  if (reviewStatus === "approved") {
    return {
      label: "Human verified",
      tone: "approved",
    };
  }

  if (reviewStatus === "rejected") {
    return {
      label: "Human rejected",
      tone: "rejected",
    };
  }

  return {
    label: "Awaiting review",
    tone: "pending",
  };
}

export default function ApprovalPanel({ task }) {
  const { api, refreshDashboard, selectTask, setActionStatus } = useDashboardContext();
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [mode, setMode] = useState("idle");
  const [pendingAction, setPendingAction] = useState("");
  const meta = task && task.meta ? task.meta : {};
  const reviewStatus = normalizeReviewStatus(meta.reviewStatus);
  const hasRuns = task && task.runs && task.runs.length > 0;

  // Show approval panel if:
  // 1. Task is done, OR
  // 2. Task has runs (agent has done work), OR
  // 3. Task already has a review status
  const shouldRender = meta.status === "done" || hasRuns || reviewStatus;

  if (!shouldRender) {
    return null;
  }

  const badge = getReviewBadge(meta);
  const isBusy = Boolean(pendingAction);

  async function approve() {
    if (!meta.id) {
      return;
    }

    setError("");
    setPendingAction("approve");
    try {
      await api.postJson(`/api/tasks/${encodeURIComponent(meta.id)}/approve`, {});
      await refreshDashboard(meta.id);
      setActionStatus(`Approved ${meta.id}.`, "success");
    } catch (caught) {
      setError(caught.message || "Unable to approve task.");
      setActionStatus(caught.message || "Unable to approve task.", "error");
    } finally {
      setPendingAction("");
    }
  }

  async function reject() {
    if (!meta.id || !feedback.trim()) {
      return;
    }

    setError("");
    setPendingAction("reject");
    try {
      const result = await api.postJson(
        `/api/tasks/${encodeURIComponent(meta.id)}/reject`,
        { feedback },
      );
      await refreshDashboard(meta.id);
      const correctionId = result && result.correctionTask ? result.correctionTask.id : "";
      setActionStatus(
        correctionId
          ? `Rejected ${meta.id}; created ${correctionId}.`
          : `Rejected ${meta.id}.`,
        "success",
      );
      setFeedback("");
      setMode("idle");
    } catch (caught) {
      setError(caught.message || "Unable to reject task.");
      setActionStatus(caught.message || "Unable to reject task.", "error");
    } finally {
      setPendingAction("");
    }
  }

  return (
    <article className={`detail-card approval-panel approval-panel-${badge.tone}`}>
      <div className="approval-panel-head">
        <div>
          <h3>Human Review</h3>
          <p className="subtle">
            {reviewStatus
              ? `Reviewed ${formatTimestampLabel(meta.reviewedAt)}.`
              : "Close the loop on completed agent work."}
          </p>
        </div>
        <span className={badge.tone === "rejected" ? "tag warn" : "tag"}>
          {badge.label}
        </span>
      </div>

      {reviewStatus === "approved" ? (
        <p>Approved work contributes a human-verified boost to this task's trust score.</p>
      ) : null}

      {reviewStatus === "rejected" ? (
        <div className="approval-review-body">
          {meta.rejectionFeedback ? (
            <div className="approval-feedback-display">
              <span>Feedback</span>
              <p>{meta.rejectionFeedback}</p>
            </div>
          ) : null}
          {meta.correctionTaskId ? (
            <button
              className="secondary-button"
              onClick={() => selectTask(meta.correctionTaskId)}
              type="button"
            >
              Open correction task {meta.correctionTaskId}
            </button>
          ) : null}
        </div>
      ) : null}

      {!reviewStatus ? (
        <div className="approval-actions">
          <div className="form-inline-actions">
            <button
              className="approval-button approval-button-approve"
              disabled={isBusy}
              onClick={approve}
              type="button"
            >
              {pendingAction === "approve" ? "Approving..." : "Approve"}
            </button>
            <button
              className="approval-button approval-button-reject"
              disabled={isBusy}
              onClick={() => setMode(mode === "reject" ? "idle" : "reject")}
              type="button"
            >
              Reject
            </button>
          </div>
          {mode === "reject" ? (
            <div className="approval-reject-form">
              <label>
                <span>Feedback</span>
                <textarea
                  onInput={(event) => setFeedback(event.currentTarget.value)}
                  placeholder="What should the next agent correct?"
                  value={feedback}
                />
              </label>
              <button
                className="approval-button approval-button-reject"
                disabled={isBusy || !feedback.trim()}
                onClick={reject}
                type="button"
              >
                {pendingAction === "reject" ? "Rejecting..." : "Submit rejection"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="approval-error">{error}</div> : null}
    </article>
  );
}
