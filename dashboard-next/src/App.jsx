import { useState } from "preact/hooks";
import CreateTaskForm from "./components/CreateTaskForm.jsx";
import Header from "./components/Header.jsx";
import Layout from "./components/Layout.jsx";
import LoadingSkeleton from "./components/LoadingSkeleton.jsx";
import Modal from "./components/Modal.jsx";
import Overview from "./components/Overview.jsx";
import TabBar from "./components/TabBar.jsx";
import TaskDetail from "./components/TaskDetail.jsx";
import TaskList from "./components/TaskList.jsx";
import Forms from "./components/Forms.jsx";
import {
  DashboardProvider,
  useDashboardContext,
} from "./context/DashboardContext.jsx";
import useTheme from "./hooks/useTheme.js";
import {
  describeRunPresentation,
  formatTimestampLabel,
  formatVerificationGateLabel,
  isVerificationGateWarning,
} from "./utils/execution.js";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "actions", label: "Actions" },
  { id: "verification", label: "Verification" },
  { id: "runs", label: "Runs" },
];

function VerificationPanel({ hidden }) {
  const { state } = useDashboardContext();
  const items = state.overview.data?.verification || [];

  return (
    <section
      className={hidden ? "panel tab-hidden" : "panel"}
      data-tab="verification"
    >
      <div className="panel-head">
        <div>
          <h2>Verify</h2>
          <p>
            What has evidence today, where coverage is partial, and which tasks
            still need proof.
          </p>
        </div>
      </div>
      <div className="list">
        {items.length === 0 ? (
          <div className="empty">No verification items are available yet.</div>
        ) : (
          items.map((item) => (
            <article
              className="list-item"
              key={`${item.taskId}:${item.status}`}
            >
              <h3>{item.taskId}</h3>
              <p>{item.summary || "No verification summary available."}</p>
              <div className="tag-row">
                <span
                  className={
                    isVerificationGateWarning(item.status) ? "tag warn" : "tag"
                  }
                >
                  {formatVerificationGateLabel(
                    item.status,
                    item.relevantChangeCount || 0,
                  )}
                </span>
                <span className="tag">
                  {item.coveragePercent || 0}% coverage
                </span>
                <span className="tag">
                  {item.scopeHintCount || 0} scope hints
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function RunsPanel({ hidden }) {
  const { state } = useDashboardContext();
  const runs = state.overview.data?.runs || [];

  return (
    <section
      className={hidden ? "panel panel-wide tab-hidden" : "panel panel-wide"}
      data-tab="runs"
    >
      <div className="panel-head">
        <div>
          <h2>Recent Runs</h2>
          <p>
            Execution evidence recorded by the workflow layer, including proof
            paths, checks, and artifacts.
          </p>
        </div>
      </div>
      <div className="list">
        {runs.length === 0 ? (
          <div className="empty">No runs recorded yet.</div>
        ) : (
          runs.map((run) => {
            const presentation = describeRunPresentation(run);

            return (
              <article className="list-item" key={run.id}>
                <h3>
                  {run.taskId} - {presentation.headline}
                </h3>
                <p>{presentation.summary}</p>
                <div className="tag-row">
                  <span className={presentation.warn ? "tag warn" : "tag"}>
                    {run.status || "recorded"}
                  </span>
                  <span className="tag">{run.agent || "manual"}</span>
                  <span className="tag">
                    {formatTimestampLabel(run.createdAt)}
                  </span>
                </div>
                {presentation.detail ? (
                  <p className="subtle">{presentation.detail}</p>
                ) : null}
                {Array.isArray(run.scopeProofPaths) &&
                run.scopeProofPaths.length > 0 ? (
                  <p className="subtle">
                    Files: {run.scopeProofPaths.join(", ")}
                  </p>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function DashboardShell() {
  const { refreshDashboard, requestState, selectTask, setActiveTab, state } = useDashboardContext();
  const { resolvedTheme, setTheme, theme } = useTheme();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Show loading skeleton while initial data is loading
  if (state.overview.status === "loading") {
    return <LoadingSkeleton />;
  }

  function handleCreateTask() {
    setIsCreateModalOpen(true);
  }

  function handleTaskCreated(task) {
    setIsCreateModalOpen(false);
    // Switch to tasks tab and select the new task
    setActiveTab("tasks");
    selectTask(task.taskId);
    // Refresh dashboard to show the new task
    refreshDashboard();
  }

  return (
    <>
      <Layout
        header={
          <Header
            actionStatus={state.actionStatus}
            activeTab={state.activeTab}
            initialized={Boolean(state.overview.data?.initialized)}
            onCreateTask={handleCreateTask}
            onThemeChange={setTheme}
            pendingCount={requestState.pendingCount}
            resolvedTheme={resolvedTheme}
            theme={theme}
            workspaceRoot={state.overview.data?.workspaceRoot || ""}
          />
        }
        navigation={
          <TabBar
            activeTab={state.activeTab}
            onSelect={setActiveTab}
            tabs={TABS}
          />
        }
      >
        <Overview hidden={state.activeTab !== "overview"} />
        <TaskList hidden={state.activeTab !== "tasks"} />
        <TaskDetail hidden={state.activeTab !== "tasks"} />
        <Forms hidden={state.activeTab !== "actions"} />
        <VerificationPanel hidden={state.activeTab !== "verification"} />
        <RunsPanel hidden={state.activeTab !== "runs"} />
      </Layout>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)}>
        <CreateTaskForm
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleTaskCreated}
        />
      </Modal>
    </>
  );
}

export default function App() {
  return (
    <DashboardProvider>
      <DashboardShell />
    </DashboardProvider>
  );
}
