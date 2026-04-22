import { formatTimestampLabel } from "../utils/execution.js";
import {
  calculateCollectorDiversityScore,
  normalizeTrustFreshness,
  normalizeTrustPercent,
  normalizeTrustSignal,
  resolveTrustTone,
} from "../utils/trustScore.js";

function describeSignal(signal) {
  const normalized = normalizeTrustSignal(signal);
  if (normalized === "verified") {
    return "verified signal";
  }
  if (normalized === "partial") {
    return "verified + draft";
  }
  if (normalized === "draft") {
    return "draft-only";
  }
  return "no signal";
}

function describeFreshness(freshness) {
  const normalized = normalizeTrustFreshness(freshness);
  if (normalized === "current") {
    return "current evidence";
  }
  if (normalized === "recorded") {
    return "recorded evidence";
  }
  return "stale evidence";
}

export default function TrustScore({
  className = "",
  collectorCount = 0,
  coverage = 0,
  freshness = "stale",
  lastEvidenceAt = null,
  score = 0,
  signal = "none",
  subtitle = "",
  title = "Trust Score",
}) {
  const normalizedScore = normalizeTrustPercent(score);
  const normalizedCoverage = normalizeTrustPercent(coverage);
  const tone = resolveTrustTone(normalizedScore);
  const diversity = calculateCollectorDiversityScore(collectorCount);
  const classes = [className, "trust-score-card", `trust-tone-${tone}`]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes}>
      <div className="trust-score-head">
        <div
          aria-label={`Trust score ${normalizedScore} out of 100`}
          className="trust-score-ring"
          style={{ "--trust-progress": `${normalizedScore}%` }}
        >
          <span>{normalizedScore}</span>
        </div>
        <div className="trust-score-copy">
          <p className="panel-eyebrow">{title}</p>
          <h3>{describeSignal(signal)}</h3>
          <p>
            {subtitle ||
              `${describeFreshness(freshness)} across ${normalizedCoverage}% scoped coverage.`}
          </p>
        </div>
      </div>

      <div className="trust-score-metrics">
        <div className="trust-score-metric">
          <span>Coverage</span>
          <strong>{normalizedCoverage}%</strong>
        </div>
        <div className="trust-score-metric">
          <span>Diversity</span>
          <strong>{diversity}%</strong>
        </div>
      </div>

      <div className="tag-row">
        <span className="tag">{describeFreshness(freshness)}</span>
        <span className="tag">{collectorCount} collector(s)</span>
        {lastEvidenceAt ? (
          <span className="tag">{formatTimestampLabel(lastEvidenceAt)}</span>
        ) : null}
      </div>
    </article>
  );
}
