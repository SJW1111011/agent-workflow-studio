export default function Header() {
  return (
    <header className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Next dashboard shell</p>
        <h1>Agent Workflow Studio</h1>
        <p className="lede">
          A Vite + Preact scaffold for the future control plane, landing the build pipeline before feature migration.
        </p>
      </div>
      <div className="hero-meta">
        <div className="badge">Warm-beige design system carried forward</div>
        <div className="badge">Legacy dashboard preserved behind `--legacy-dashboard`</div>
      </div>
    </header>
  );
}
