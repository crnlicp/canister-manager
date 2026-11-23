import { useState, type FormEvent } from "react";
import {
  FolderPlus,
  Folder,
  Layers3,
  Pencil,
  Trash2,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import type { Entry, Project } from "../bindings/backend";
import { bytes, cycles } from "../lib/format";
import { projectFor, scopeEntries, summarize } from "../lib/projects";
import { Modal } from "./Modal";

type Props = {
  entries: Entry[];
  projects: Project[];
  scope: string;
  onScope: (scope: string) => void;
  demo: boolean;
  busy: boolean;
  onSave: (id: bigint | null, name: string) => Promise<boolean>;
  onDelete: (id: bigint) => Promise<boolean>;
  onAssign: (canisterId: string, projectId: string) => Promise<void>;
  onRefresh: (entries: Entry[]) => void;
};

export function Projects({
  entries,
  projects,
  scope,
  onScope,
  demo,
  busy,
  onSave,
  onDelete,
  onAssign,
  onRefresh,
}: Props) {
  const [editing, setEditing] = useState<{ id: bigint | null; name: string }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const scoped = scopeEntries(entries, projects, scope);
  const summary = summarize(scoped);
  const selectedProject = projects.find(
    (project) => project.id.toString() === scope,
  );
  const scopeName =
    scope === "all"
      ? "All projects"
      : scope === "ungrouped"
        ? "Ungrouped"
        : (selectedProject?.name ?? "All projects");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      if (await onSave(editing.id, editing.name.trim())) setEditing(undefined);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <section className="projects-section" aria-label="Project monitoring">
        <header className="project-heading">
          <div>
            <span className="eyebrow">ONE WORKSPACE. EVERY PROJECT.</span>
            <h2>
              Organize your orbit{" "}
              <span className="count-pill">{projects.length} projects</span>
            </h2>
          </div>
          <button
            className="button primary"
            onClick={() => {
              setEditing({ id: null, name: "" });
              setConfirmDelete(false);
            }}
          >
            <FolderPlus size={15} />
            New project
          </button>
        </header>
        <div className="project-cards">
          {[
            { key: "all", name: "All projects", icon: Layers3 },
            ...projects.map((project) => ({
              key: project.id.toString(),
              name: project.name,
              icon: Folder,
            })),
            { key: "ungrouped", name: "Ungrouped", icon: Folder },
          ].map((item) => {
            const totals = summarize(scopeEntries(entries, projects, item.key));
            return (
              <button
                key={item.key}
                aria-pressed={scope === item.key}
                className={`project-card ${scope === item.key ? "selected" : ""}`}
                onClick={() => onScope(item.key)}
              >
                <span className="project-card-top">
                  <item.icon size={17} />
                  <span>
                    {totals.count} canister{totals.count !== 1 ? "s" : ""}
                  </span>
                  <ArrowUpRight size={14} />
                </span>
                <strong>{item.name}</strong>
                <span className="project-card-balance">
                  {totals.reported ? cycles(totals.cycles) : "—"}
                  <small>available cycles</small>
                </span>
                <span className="project-card-bottom">
                  <span>
                    {totals.reported}/{totals.count} reported
                  </span>
                  <span
                    className={totals.attention ? "amber-text" : "mint-text"}
                  >
                    {totals.attention
                      ? `${totals.attention} need attention`
                      : totals.count
                        ? "All healthy"
                        : "No canisters"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="glass project-scope">
          <div className="project-scope-heading">
            <div>
              <span className="eyebrow">MONITORING SCOPE</span>
              <h2>{scopeName}</h2>
            </div>
            <div className="inline-actions">
              <button
                className="button secondary small-button"
                disabled={demo || busy || !scoped.length}
                onClick={() => onRefresh(scoped)}
              >
                <RefreshCw size={13} />
                Refresh {scope === "all" ? "workspace" : "project"}
              </button>
              {selectedProject && (
                <button
                  className="icon-button"
                  aria-label={`Manage ${selectedProject.name}`}
                  onClick={() => {
                    setEditing({
                      id: selectedProject.id,
                      name: selectedProject.name,
                    });
                    setConfirmDelete(false);
                  }}
                >
                  <Pencil size={15} />
                </button>
              )}
            </div>
          </div>
          <dl className="project-totals">
            <div>
              <dt>Cycle balance</dt>
              <dd>{summary.reported ? cycles(summary.cycles) : "—"}</dd>
            </div>
            <div>
              <dt>Idle burn / day</dt>
              <dd>{summary.reported ? cycles(summary.burn) : "—"}</dd>
            </div>
            <div>
              <dt>Total memory</dt>
              <dd>{summary.reported ? bytes(summary.memory) : "—"}</dd>
            </div>
            <div>
              <dt>Snapshot coverage</dt>
              <dd>
                {summary.reported} / {summary.count}
                <small>{summary.attention} need attention</small>
              </dd>
            </div>
          </dl>
          <p className="muted small">
            Project totals use the latest available snapshots and may include
            stale data. Workspace totals above always include every canister
            once.
          </p>
        </div>
      </section>
      {editing && (
        <Modal
          title={editing.id === null ? "Create a project" : "Manage project"}
          onClose={() => !saving && setEditing(undefined)}
        >
          <p className="dialog-description">
            One project can contain several canisters. Each canister belongs to
            one project, or stays Ungrouped.
          </p>
          {demo && (
            <div className="inline-notice">
              Demo projects are read-only. Connect your identity and open your
              workspace to save projects.
            </div>
          )}
          <form onSubmit={(event) => void submit(event)}>
            <label className="field-label" htmlFor="project-name">
              Project name
            </label>
            <input
              id="project-name"
              className="form-input"
              maxLength={80}
              required
              autoFocus
              value={editing.name}
              onChange={(event) =>
                setEditing({ ...editing, name: event.target.value })
              }
              placeholder="e.g. My app · Production"
            />
            <div className="form-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(undefined)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="button primary"
                disabled={demo || busy || saving || !editing.name.trim()}
              >
                {saving
                  ? "Saving…"
                  : editing.id === null
                    ? "Create project"
                    : "Save name"}
              </button>
            </div>
          </form>
          {editing.id !== null && (
            <>
              <h3 className="section-title">Canister membership</h3>
              <p className="muted small">
                Move existing canisters between projects without changing their
                history, permissions, or workspace totals.
              </p>
              <div className="project-members">
                {entries.map((entry) => (
                  <label key={entry.id.toText()} className="project-member">
                    <span>
                      <strong>{entry.name}</strong>
                      <code>{entry.id.toText()}</code>
                    </span>
                    <select
                      aria-label={`Project for ${entry.name}`}
                      disabled={demo || busy || saving}
                      value={
                        projectFor(
                          projects,
                          entry.id.toText(),
                        )?.id.toString() ?? "ungrouped"
                      }
                      onChange={(event) =>
                        void onAssign(entry.id.toText(), event.target.value)
                      }
                    >
                      <option value="ungrouped">Ungrouped</option>
                      {projects.map((project) => (
                        <option
                          key={project.id.toString()}
                          value={project.id.toString()}
                        >
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="project-delete">
                {confirmDelete ? (
                  <>
                    <p className="muted small">
                      Delete this project? Its canisters move to Ungrouped.
                      Their snapshots and history are kept.
                    </p>
                    <button
                      className="button secondary danger"
                      disabled={busy || saving}
                      onClick={async () => {
                        setSaving(true);
                        try {
                          if (await onDelete(editing.id!))
                            setEditing(undefined);
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      Confirm delete project
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="text-button danger"
                    disabled={demo || busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={14} />
                    Delete project only
                  </button>
                )}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
