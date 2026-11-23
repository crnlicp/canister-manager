import { useState } from "react";
import {
  ArrowUpRight,
  Copy,
  Download,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { Entry, Project } from "../bindings/backend";
import {
  bytes,
  cycles,
  download,
  errorMessage,
  health,
  hex,
  timeAgo,
} from "../lib/format";
import { isLocal, publicMetadata } from "../lib/ic";
import { CycleChart } from "./Chart";
import { Modal } from "./Modal";

type Props = {
  entry: Entry;
  demo: boolean;
  busy: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onRemove: () => void;
  onSetup: () => void;
  notify: (message: string, error?: boolean) => void;
  projects: Project[];
  projectId: string;
  onAssign: (projectId: string) => void;
};

export function CanisterDetails({
  entry,
  demo,
  busy,
  onClose,
  onRefresh,
  onRemove,
  onSetup,
  notify,
  projects,
  projectId,
  onAssign,
}: Props) {
  const [tab, setTab] = useState("Overview");
  const [metadata, setMetadata] =
    useState<Awaited<ReturnType<typeof publicMetadata>>>();
  const [fetching, setFetching] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const status = entry.snapshot?.details;
  const id = entry.id.toText();
  const copy = () =>
    void navigator.clipboard.writeText(id).then(
      () => notify("Canister ID copied."),
      (error) => notify(errorMessage(error), true),
    );
  const fetchMetadata = async () => {
    setFetching(true);
    try {
      setMetadata(await publicMetadata(entry.id));
    } catch (error) {
      notify(
        `Public metadata could not be fetched: ${errorMessage(error)}`,
        true,
      );
    } finally {
      setFetching(false);
    }
  };
  return (
    <Modal title={entry.name} onClose={onClose} drawer>
      <div className="id-line">
        <code>{id}</code>
        <button
          className="icon-button"
          aria-label="Copy canister ID"
          onClick={copy}
        >
          <Copy size={15} />
        </button>
      </div>
      <label className="field-label" htmlFor="detail-project">
        Project
      </label>
      <select
        id="detail-project"
        className="form-input"
        value={projectId}
        disabled={demo || busy}
        onChange={(event) => onAssign(event.target.value)}
      >
        <option value="ungrouped">Ungrouped</option>
        {projects.map((project) => (
          <option key={project.id.toString()} value={project.id.toString()}>
            {project.name}
          </option>
        ))}
      </select>
      <div className="detail-actions">
        <span
          className={`badge ${health(entry).toLowerCase().replaceAll(" ", "-")}`}
        >
          <i />
          {health(entry)}
        </span>
        <button
          className="button small-button secondary"
          disabled={demo || busy}
          onClick={onRefresh}
        >
          <RefreshCw size={14} />
          Refresh status
        </button>
      </div>
      {demo && (
        <div className="inline-notice">
          Sample data, not the actual status of this canister.
        </div>
      )}
      {entry.lastError && (
        <div className="inline-notice error">
          {entry.lastError}
          <button className="text-button" onClick={onSetup}>
            View access setup <ArrowUpRight size={14} />
          </button>
        </div>
      )}
      <div className="tabs">
        {["Overview", "Resources", "Interface"].map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Overview" && (
        <>
          <div className="detail-metrics">
            <div>
              <span className="muted small">Cycle balance</span>
              <strong>{status ? cycles(status.cycles) : "—"}</strong>
            </div>
            <div>
              <span className="muted small">Memory used</span>
              <strong>{status ? bytes(status.memory_size) : "—"}</strong>
            </div>
          </div>
          <h3 className="section-title">
            Cycle history{" "}
            <span className="muted small">
              {entry.history.length} / 60 samples
            </span>
          </h3>
          <CycleChart points={entry.history} />
          <dl className="data-list">
            <div>
              <dt>Canister version</dt>
              <dd>{status?.version?.toLocaleString() ?? "Not reported"}</dd>
            </div>
            <div>
              <dt>Ready for migration</dt>
              <dd>
                {status?.ready_for_migration === undefined
                  ? "Not reported"
                  : status.ready_for_migration
                    ? "Yes"
                    : "No"}
              </dd>
            </div>
            <div>
              <dt>Runtime status</dt>
              <dd>{status?.status ?? "Not available"}</dd>
            </div>
            <div>
              <dt>Last snapshot</dt>
              <dd>
                {entry.snapshot
                  ? `${timeAgo(entry.snapshot.at)} · ${new Date(Number(entry.snapshot.at / 1_000_000n)).toLocaleString()}`
                  : "Never"}
              </dd>
            </div>
            <div>
              <dt>Idle burn / day</dt>
              <dd>
                {status ? cycles(status.idle_cycles_burned_per_day) : "—"}
              </dd>
            </div>
            <div>
              <dt>Estimated idle runway</dt>
              <dd>
                {status?.idle_cycles_burned_per_day
                  ? `${status.cycles / status.idle_cycles_burned_per_day} days`
                  : "Not estimable"}
              </dd>
            </div>
          </dl>
          <p className="muted small">
            Idle runway excludes traffic and execution costs. It is not a
            prediction of when the canister will freeze.
          </p>
          <h3 className="section-title">
            <ShieldCheck size={16} /> Controllers
          </h3>
          {status?.settings.controllers.map((controller) => (
            <code className="code-block" key={controller.toText()}>
              {controller.toText()}
            </code>
          ))}
          {!status && (
            <p className="muted small">
              Detailed status is not available yet. Use Interface to fetch
              public controllers.
            </p>
          )}
          <h3 className="section-title">Module hash</h3>
          <code className="code-block">
            {status ? hex(status.module_hash) : "Not available"}
          </code>
        </>
      )}
      {tab === "Resources" && (
        <>
          <h3 className="section-title">Allocation & cycle settings</h3>
          <dl className="data-list">
            <div>
              <dt>Compute allocation</dt>
              <dd>{status ? `${status.settings.compute_allocation}%` : "—"}</dd>
            </div>
            <div>
              <dt>Memory allocation</dt>
              <dd>{status ? bytes(status.settings.memory_allocation) : "—"}</dd>
            </div>
            <div>
              <dt>Freezing threshold</dt>
              <dd>
                {status
                  ? `${status.settings.freezing_threshold.toLocaleString()} seconds`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Reserved cycles</dt>
              <dd>{status ? cycles(status.reserved_cycles) : "—"}</dd>
            </div>
            <div>
              <dt>Reserved cycles limit</dt>
              <dd>
                {status ? cycles(status.settings.reserved_cycles_limit) : "—"}
              </dd>
            </div>
            <div>
              <dt>Wasm memory limit</dt>
              <dd>
                {status?.settings.wasm_memory_limit !== undefined
                  ? bytes(status.settings.wasm_memory_limit)
                  : "Not reported"}
              </dd>
            </div>
            <div>
              <dt>Wasm memory threshold</dt>
              <dd>
                {status?.settings.wasm_memory_threshold !== undefined
                  ? bytes(status.settings.wasm_memory_threshold)
                  : "Not reported"}
              </dd>
            </div>
            <div>
              <dt>Status visibility</dt>
              <dd>
                {status?.settings.status_visibility?.__kind__ ??
                  "Controllers (legacy default)"}
              </dd>
            </div>
            <div>
              <dt>Snapshot visibility</dt>
              <dd>
                {status?.settings.snapshot_visibility?.__kind__ ??
                  "Not reported"}
              </dd>
            </div>
            <div>
              <dt>Log memory limit</dt>
              <dd>
                {status?.settings.log_memory_limit === undefined
                  ? "Not reported"
                  : bytes(status.settings.log_memory_limit)}
              </dd>
            </div>
            <div>
              <dt>Log visibility</dt>
              <dd>
                {status?.settings.log_visibility?.__kind__ ?? "Not reported"}
              </dd>
            </div>
          </dl>
          <h3 className="section-title">Network-reported query statistics</h3>
          <p className="muted small">
            Replica-aggregated counters, not a real-time throughput measurement.
          </p>
          <dl className="data-list">
            <div>
              <dt>Total query calls</dt>
              <dd>
                {status?.query_stats.num_calls_total.toLocaleString() ?? "—"}
              </dd>
            </div>
            <div>
              <dt>Instructions</dt>
              <dd>
                {status?.query_stats.num_instructions_total.toLocaleString() ??
                  "—"}
              </dd>
            </div>
            <div>
              <dt>Request payloads</dt>
              <dd>
                {status
                  ? bytes(status.query_stats.request_payload_bytes_total)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Response payloads</dt>
              <dd>
                {status
                  ? bytes(status.query_stats.response_payload_bytes_total)
                  : "—"}
              </dd>
            </div>
          </dl>
          <h3 className="section-title">Memory breakdown</h3>
          {status?.memory_metrics ? (
            <dl className="data-list">
              {Object.entries(status.memory_metrics).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replaceAll("_", " ")}</dt>
                  <dd>{value === undefined ? "Not reported" : bytes(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted small">
              This replica did not report a memory breakdown.
            </p>
          )}
          <details className="raw-data">
            <summary>Exact cycle balance</summary>
            <code>{status?.cycles.toLocaleString() ?? "—"} cycles</code>
          </details>
        </>
      )}
      {tab === "Interface" && (
        <>
          <div className="inline-notice">
            <ShieldCheck size={17} />
            <span>
              Read certified public metadata directly from the IC. No controller
              access required. Unpublished fields are shown as unavailable.
            </span>
          </div>
          <button
            className="button secondary"
            onClick={() => void fetchMetadata()}
            disabled={fetching || demo}
          >
            <RefreshCw size={15} className={fetching ? "spinning" : ""} />
            {fetching ? "Reading certificate…" : "Fetch public metadata"}
          </button>
          {metadata && (
            <>
              <dl className="data-list">
                <div>
                  <dt>Certified network time</dt>
                  <dd>{metadata.networkTime ?? "Unavailable"}</dd>
                </div>
              </dl>
              <h3 className="section-title">Subnet</h3>
              <code className="code-block">{metadata.subnet}</code>
              <h3 className="section-title">Public controllers</h3>
              {metadata.controllers.length ? (
                metadata.controllers.map((controller) => (
                  <code className="code-block" key={controller}>
                    {controller}
                  </code>
                ))
              ) : (
                <p className="muted">Unavailable</p>
              )}
              <h3 className="section-title">Certified module hash</h3>
              <code className="code-block">
                {metadata.moduleHash ?? "Unavailable / no installed module"}
              </code>
              <h3 className="section-title">Candid interface</h3>
              <pre className="candid">
                {metadata.candid ??
                  "This canister has not published candid:service metadata."}
              </pre>
            </>
          )}
          {!isLocal && (
            <a
              className="text-button external-link"
              href={`https://dashboard.internetcomputer.org/canister/${id}`}
              target="_blank"
              rel="noreferrer"
            >
              View on ICP Dashboard <ArrowUpRight size={15} />
            </a>
          )}
        </>
      )}
      <footer className="detail-footer">
        <button
          className="button secondary"
          onClick={() =>
            download(`orbit-${id}.json`, {
              source: demo ? "demo" : "ic-network-snapshots",
              ...entry,
            })
          }
        >
          <Download size={15} />
          Export JSON
        </button>
        {!demo &&
          (confirm ? (
            <div className="confirm-remove">
              <span>Remove from watchlist only?</span>
              <button
                className="text-button danger"
                disabled={busy}
                onClick={onRemove}
              >
                Confirm remove
              </button>
              <button className="text-button" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="icon-button danger"
              disabled={busy}
              aria-label="Remove from watchlist"
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={17} />
            </button>
          ))}
      </footer>
    </Modal>
  );
}
