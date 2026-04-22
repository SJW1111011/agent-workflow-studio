import {
  describeRunPresentation,
  formatTimestampLabel,
} from "../utils/execution.js";

function buildRunEvents(detail) {
  return (Array.isArray(detail.runs) ? detail.runs : []).map((run) => {
    const presentation = describeRunPresentation(run);

    return {
      id: `run:${run.id}`,
      timestamp: run.completedAt || run.createdAt,
      title: `Run ${run.id}`,
      summary: presentation.summary || run.summary || "Run evidence recorded.",
      tone: presentation.tone || "neutral",
      tags: [run.status || "recorded", run.agent || "manual"].filter(Boolean),
      files: Array.isArray(run.scopeProofPaths) ? run.scopeProofPaths : [],
      artifacts: Array.isArray(run.verificationArtifacts)
        ? run.verificationArtifacts
        : [],
    };
  });
}

function buildActivityEvents(detail) {
  return (Array.isArray(detail.activityRecords) ? detail.activityRecords : []).map(
    (record) => ({
      id: `activity:${record.id}`,
      timestamp: record.createdAt,
      title: "Activity recorded",
      summary: record.activity || "Task activity was recorded.",
      tone: "activity",
      tags: ["activity"],
      files: Array.isArray(record.filesModified) ? record.filesModified : [],
      artifacts: [],
    }),
  );
}

function buildManualEvidenceEvents(detail) {
  const proofCoverage =
    detail.verificationGate && detail.verificationGate.proofCoverage
      ? detail.verificationGate.proofCoverage
      : {};

  return (Array.isArray(proofCoverage.items) ? proofCoverage.items : [])
    .filter((item) => item && item.sourceType !== "run" && item.recordedAt)
    .map((item, index) => ({
      id: `manual:${item.sourceLabel || index}`,
      timestamp: item.recordedAt,
      title: item.verified ? "Manual evidence recorded" : "Draft evidence noted",
      summary:
        item.sourceLabel ||
        "Verification notes now point at explicit task evidence.",
      tone: item.verified ? "verified" : "draft",
      tags: [item.sourceType || "manual"],
      files: Array.isArray(item.paths) ? item.paths : [],
      artifacts: Array.isArray(item.artifacts) ? item.artifacts : [],
    }));
}

function buildVerificationUpdateEvent(detail) {
  const verificationUpdatedAt =
    detail.verificationGate &&
    detail.verificationGate.evidence &&
    detail.verificationGate.evidence.verificationUpdatedAt;

  if (!verificationUpdatedAt) {
    return [];
  }

  return [
    {
      id: "verification:update",
      timestamp: verificationUpdatedAt,
      title: "verification.md updated",
      summary: "Task verification notes were refreshed.",
      tone: "verification",
      tags: ["verification"],
      files: [".agent-workflow/tasks/" + detail.meta.id + "/verification.md"],
      artifacts: [],
    },
  ];
}

function buildEvidenceEvents(detail) {
  return []
    .concat(buildRunEvents(detail))
    .concat(buildActivityEvents(detail))
    .concat(buildManualEvidenceEvents(detail))
    .concat(buildVerificationUpdateEvent(detail))
    .filter((event) => Number.isFinite(new Date(event.timestamp).getTime()))
    .sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    );
}

export default function EvidenceTimeline({ detail }) {
  const events = buildEvidenceEvents(detail);

  if (events.length === 0) {
    return <div className="empty">No evidence events recorded yet.</div>;
  }

  return (
    <div className="evidence-timeline" role="list">
      {events.map((event) => (
        <article
          className={`evidence-timeline-item evidence-timeline-${event.tone}`}
          key={event.id}
          role="listitem"
        >
          <div className="evidence-timeline-marker" aria-hidden="true" />
          <div className="evidence-timeline-body">
            <p className="subtle">{formatTimestampLabel(event.timestamp)}</p>
            <h3>{event.title}</h3>
            <p>{event.summary}</p>
            <div className="tag-row">
              {event.tags.map((tag) => (
                <span className="tag" key={`${event.id}:${tag}`}>
                  {tag}
                </span>
              ))}
            </div>
            {event.files.length > 0 ? (
              <p className="subtle">Files: {event.files.join(", ")}</p>
            ) : null}
            {event.artifacts.length > 0 ? (
              <p className="subtle">Artifacts: {event.artifacts.join(", ")}</p>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
