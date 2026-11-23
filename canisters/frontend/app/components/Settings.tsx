import {
  Copy,
  ExternalLink,
  Fingerprint,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { backendId, isLocal, networkName } from "../lib/ic";
import { errorMessage } from "../lib/format";

type Props = {
  principal: string | null;
  autoRefresh: boolean;
  setAutoRefresh: (value: boolean) => void;
  notify: (message: string, error?: boolean) => void;
};

export function Settings({
  principal,
  autoRefresh,
  setAutoRefresh,
  notify,
}: Props) {
  const copy = (value: string) =>
    void navigator.clipboard.writeText(value).then(
      () => notify("Copied to clipboard."),
      (error) => notify(errorMessage(error), true),
    );
  const command = `icp canister settings update <CANISTER_ID> \\\n  --add-status-viewer ${backendId ?? "<BACKEND_CANISTER_ID>"} \\\n  --add-status-viewer ${principal ?? "<YOUR_SIGNED_IN_PRINCIPAL>"} \\\n  -n ${isLocal ? "local" : "ic"}`;
  return (
    <div className="settings-grid">
      <section className="glass settings-panel">
        <div className="panel-title">
          <span className="tile-icon">
            <Fingerprint size={19} />
          </span>
          <div>
            <h2>Your on-chain workspace</h2>
            <p className="muted small">
              Internet Identity · private to your principal
            </p>
          </div>
        </div>
        <label className="field-label">Your signed-in principal</label>
        <div className="copy-field">
          <code>{principal ?? "Sign in to see your principal"}</code>
          <button
            className="icon-button"
            aria-label="Copy your principal"
            disabled={!principal}
            onClick={() => principal && copy(principal)}
          >
            <Copy size={16} />
          </button>
        </div>
        <label className="field-label">Monitoring backend</label>
        <div className="copy-field">
          <code>{backendId ?? "Not deployed — preview mode"}</code>
          <button
            className="icon-button"
            aria-label="Copy backend ID"
            disabled={!backendId}
            onClick={() => backendId && copy(backendId)}
          >
            <Copy size={16} />
          </button>
        </div>
        <dl className="data-list">
          <div>
            <dt>Network</dt>
            <dd>{networkName}</dd>
          </div>
          <div>
            <dt>Persistence</dt>
            <dd>On-chain, upgrade-persistent</dd>
          </div>
          <div>
            <dt>Watchlist capacity</dt>
            <dd>20 canisters per account</dd>
          </div>
          <div>
            <dt>History retention</dt>
            <dd>Latest 60 samples per canister</dd>
          </div>
        </dl>
        <div className="toggle-row">
          <div>
            <strong>Auto-refresh</strong>
            <p className="muted small">
              Every minute, while this tab is visible.
              <br />
              Requests consume backend cycles.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={autoRefresh}
            aria-label="Auto-refresh"
            className={`switch ${autoRefresh ? "on" : ""}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <span />
          </button>
        </div>
      </section>
      <section className="glass settings-panel">
        <div className="panel-title">
          <span className="tile-icon">
            <ShieldCheck size={19} />
          </span>
          <div>
            <h2>Enable detailed monitoring</h2>
            <p className="muted small">One-time setup for each canister</p>
          </div>
        </div>
        <ol className="setup-steps">
          <li>
            <span>1</span>
            <div>
              <strong>Sign in & add your canister</strong>
              <p>
                Use your canister’s principal ID. Your watchlist is saved
                on-chain.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Grant read-only status access</strong>
              <p>
                Using an existing controller identity, add both principals as
                status viewers. This does not grant upgrade or delete rights.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Refresh the canister</strong>
              <p>
                Orbit checks the network’s status policy before releasing
                details. If status is already public, no permission change is
                needed.
              </p>
            </div>
          </li>
        </ol>
        <div className="command-block">
          <pre>{command}</pre>
          <button
            className="icon-button"
            aria-label="Copy status viewer setup command"
            onClick={() => copy(command)}
          >
            <Copy size={16} />
          </button>
        </div>
        <div className="inline-notice warning-notice">
          <TriangleAlert size={19} />
          <div>
            <strong>Monitoring should not require full control.</strong>
            <p>
              Prefer status-viewer access. Older replicas may only support
              controller access, which also allows upgrades and deletion. Never
              grant that powerful fallback to a backend you do not control and
              trust. Existing controllers can read status too.
            </p>
          </div>
        </div>
        <a
          className="text-button"
          href="https://docs.internetcomputer.org/references/management-canister/"
          target="_blank"
          rel="noreferrer"
        >
          Read the IC interface specification <ExternalLink size={14} />
        </a>
      </section>
    </div>
  );
}
