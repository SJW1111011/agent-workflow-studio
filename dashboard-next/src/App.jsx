import { useState } from "preact/hooks";
import Header from "./components/Header.jsx";
import Layout from "./components/Layout.jsx";
import TabBar from "./components/TabBar.jsx";

const TABS = [
  {
    id: "overview",
    label: "Overview",
    eyebrow: "Foundation",
    title: "Shared product signals land here first.",
    body: "Overview cards, adapters, schema, memory freshness, and risk summaries migrate into composable Preact panels after the shell is in place.",
  },
  {
    id: "tasks",
    label: "Tasks",
    eyebrow: "Queue",
    title: "Task board and detail stay in the legacy dashboard for now.",
    body: "This tab reserves the layout for the future task list, task detail, and selection flows without porting the current mutation surface yet.",
  },
  {
    id: "actions",
    label: "Actions",
    eyebrow: "Operations",
    title: "Quick create and evidence forms move in the next migration pass.",
    body: "The Preact scaffold keeps the destination for task creation, doc editing, and run recording visible while `--legacy-dashboard` still powers those workflows today.",
  },
  {
    id: "verification",
    label: "Verification",
    eyebrow: "Trust",
    title: "Proof coverage remains a first-class concern.",
    body: "This placeholder marks where diff-aware verification, freshness, and scoped evidence affordances will live once the shell starts consuming real API data.",
  },
  {
    id: "runs",
    label: "Runs",
    eyebrow: "Execution",
    title: "Executor status, logs, and outcomes migrate after the shell settles.",
    body: "Run history and live execution panels are intentionally deferred so the shell can land without changing current workflow contracts.",
  },
];

const SIDE_CARDS = [
  {
    title: "Dev server",
    copy: "Run `npm run dashboard:dev` on port 5173 while the local API server stays on 4173.",
  },
  {
    title: "Legacy fallback",
    copy: "Use `agent-workflow dashboard --legacy-dashboard` for the current feature-complete control plane.",
  },
  {
    title: "Build output",
    copy: "Run `npm run dashboard:build` to generate `dashboard-next/dist/` for server-side static serving.",
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const activePanel = TABS.find((tab) => tab.id === activeTab) || TABS[0];

  return (
    <Layout
      header={<Header />}
      navigation={<TabBar activeTab={activeTab} onSelect={setActiveTab} tabs={TABS} />}
    >
      <section className="panel panel-wide hero-panel">
        <div className="panel-copy">
          <p className="panel-eyebrow">{activePanel.eyebrow}</p>
          <h2>{activePanel.title}</h2>
          <p>{activePanel.body}</p>
        </div>
        <div className="status-stack" aria-label="Scaffold status">
          <div className="status-pill">
            <span>Current tab</span>
            <strong>{activePanel.label}</strong>
          </div>
          <div className="status-pill">
            <span>Runtime</span>
            <strong>Vite + Preact</strong>
          </div>
          <div className="status-pill">
            <span>API target</span>
            <strong>localhost:4173</strong>
          </div>
        </div>
      </section>

      <section className="card-grid" aria-label={`${activePanel.label} placeholders`}>
        {SIDE_CARDS.map((card) => (
          <article className="panel scaffold-card" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.copy}</p>
          </article>
        ))}
      </section>

      <section className="panel panel-wide roadmap-panel" aria-label="Migration notes">
        <div className="panel-copy">
          <p className="panel-eyebrow">Migration path</p>
          <h3>Shell first, feature ports second.</h3>
        </div>
        <ul className="roadmap-list">
          <li>Keep the existing `dashboard/` UI intact as the truthful fallback.</li>
          <li>Use this shell to prove the Vite build, HMR, and component layout contract.</li>
          <li>Migrate real data panels and mutations in later tasks without breaking the API server.</li>
        </ul>
      </section>
    </Layout>
  );
}
