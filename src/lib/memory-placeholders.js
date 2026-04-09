const MEMORY_PLACEHOLDER_LINES = [
  "- What user problem are we solving?",
  "- What must never be faked?",
  "- What business outcomes matter most?",
  "- Technical constraints:",
  "- Compliance constraints:",
  "- Operational constraints:",
  "- Core modules:",
  "- Data flows:",
  "- Key dependencies:",
  "- placeholder APIs",
  "- fake verification",
  "- hidden production toggles",
  "- what must be tested?",
  "- what can only be manually verified?",
  "- what still lacks tooling?",
];

function hasMemoryPlaceholder(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  return lines.some((line) => MEMORY_PLACEHOLDER_LINES.includes(line));
}

module.exports = {
  MEMORY_PLACEHOLDER_LINES,
  hasMemoryPlaceholder,
};
