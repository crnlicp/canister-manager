import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Box,
  Boxes,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  Download,
  ExternalLink,
  Fingerprint,
  Globe2,
  LayoutDashboard,
  LayoutGrid,
  List,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import type { Backend, Entry, Project } from "./bindings/backend";
import { CycleChart, Sparkline } from "./components/Chart";
import { CanisterDetails } from "./components/CanisterDetails";
import { Modal } from "./components/Modal";
import { Settings } from "./components/Settings";
import { Projects } from "./components/Projects";
import { demoEntries, demoProjects } from "./lib/demo";
import {
  projectFor,
  projectHistory,
  scopeEntries,
  summarize,
} from "./lib/projects";
import { auth, backend, backendId, networkName } from "./lib/ic";
import {
  bytes,
  cycles,
  download,
  errorMessage,
  health,
  timeAgo,
  validateCanisterId,
} from "./lib/format";

type View = "Overview" | "Canisters" | "Cycle analytics" | "Settings";
const navigation = [
  { title: "Overview", icon: LayoutDashboard },
  { title: "Canisters", icon: Boxes },
  { title: "Cycle analytics", icon: ChartNoAxesCombined },
  { title: "Settings", icon: Settings2 },
] as const;
const subscribe = (listener: () => void) => auth.subscribe(listener);
const getPrincipal = () => auth.getPrincipal()?.toText() ?? null;

function OrbitMark() {
  return (
    <svg viewBox="0 0 48 48" className="orbit-mark" aria-hidden="true">
      <path className="orbit-logo-frame" d="M24 2 43 13v22L24 46 5 35V13Z" />
      <circle className="orbit-logo-ring" cx="24" cy="24" r="11.5" />
      <path className="orbit-logo-arc" d="M8 32c5 2 14-1 22-7s12-13 9-16" />
      <circle className="satellite" cx="34" cy="16" r="3.5" />
      <circle className="orbit-logo-core" cx="24" cy="24" r="3" />
    </svg>
  );
}

export default function App() {
  const principal = useSyncExternalStore(subscribe, getPrincipal);
  const [demo, setDemo] = useState(!auth.isAuthenticated());
  const [samples] = useState(demoEntries);
  const [live, setLive] = useState<Entry[]>([]);
  const [liveProjects, setLiveProjects] = useState<Project[]>([]);
  const [sampleProjects] = useState(demoProjects);
  const [scope, setScope] = useState("all");
  const [addProject, setAddProject] = useState("ungrouped");
  const [view, setView] = useState<View>("Overview");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [grid, setGrid] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean }>();
  const [busy, setBusy] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addId, setAddId] = useState("");
  const [addError, setAddError] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [chartId, setChartId] = useState("");
  const [range, setRange] = useState("24h");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [, tick] = useState(0);
  const api = useRef<Backend | null>(null);
  const operation = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const session = useRef(principal);
  session.current = principal;
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );

  useEffect(() => {
    const timer = setInterval(() => tick((value) => value + 1), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setView("Canisters");
        requestAnimationFrame(() => searchInput.current?.focus());
      }
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(undefined), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    let cancelled = false;
    api.current = null;
    setLive([]);
    setLiveProjects([]);
    setScope("all");
    setAddProject("ungrouped");
    setChartId("");
    setSelectedId(undefined);
    if (!principal) {
      setLoading(false);
      return;
    }
    setDemo(false);
    setLoading(true);
    void (async () => {
      try {
        const actor = backend(await auth.getIdentity());
        const [entries, projects] = await Promise.all([
          actor.listCanisters(),
          actor.listProjects(),
        ]);
        if (!cancelled) {
          api.current = actor;
          setLive(entries);
          setLiveProjects(projects);
        }
      } catch (error) {
        if (!cancelled) notify(errorMessage(error), true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [principal, notify]);

  const entries = demo ? samples : live;
  const projects = demo ? sampleProjects : liveProjects;
  const scopedEntries = scopeEntries(entries, projects, scope);
  const scopeName =
    scope === "all"
      ? "All projects"
      : scope === "ungrouped"
        ? "Ungrouped"
        : (projects.find((project) => project.id.toString() === scope)?.name ??
          "All projects");
  const visible = scopedEntries.filter(
    (entry) =>
      `${entry.name} ${entry.id.toText()}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "All statuses" || health(entry) === filter),
  );
  const snapshots = entries.flatMap((entry) =>
    entry.snapshot ? [entry.snapshot] : [],
  );
  const totalCycles = snapshots.reduce(
    (sum, snapshot) => sum + snapshot.details.cycles,
    0n,
  );
  const totalBurn = snapshots.reduce(
    (sum, snapshot) => sum + snapshot.details.idle_cycles_burned_per_day,
    0n,
  );
  const totalMemory = snapshots.reduce(
    (sum, snapshot) => sum + snapshot.details.memory_size,
    0n,
  );
  const attention = entries.filter((entry) => health(entry) !== "Healthy");
  const chartEntry = scopedEntries.find(
    (entry) => entry.id.toText() === chartId,
  );
  const scopeSummary = summarize(scopedEntries);
  const chartPoints = (
    chartEntry ? chartEntry.history : projectHistory(scopedEntries)
  ).filter(
    (point) =>
      Number(point.at / 1_000_000n) >=
      Date.now() - ({ "24h": 1, "7d": 7, "30d": 30 }[range] ?? 1) * 86_400_000,
  );
  const selected = entries.find((entry) => entry.id.toText() === selectedId);
  const switchView = (next: View) => {
    setView(next);
    setMobileNav(false);
  };
  const signIn = () => {
    setSigningIn(true);
    void auth
      .signIn()
      .catch((error) => notify(`Sign-in failed: ${errorMessage(error)}`, true))
      .finally(() => setSigningIn(false));
  };
  const requireActor = () => {
    if (!principal)
      throw new Error(
        "Sign in with Internet Identity to access your on-chain workspace.",
      );
    if (demo) throw new Error("Switch from demo to your workspace first.");
    if (!api.current)
      throw new Error(
        backendId
          ? "Workspace is still connecting. Please try again."
          : "Open the ICP-deployed frontend to connect the backend.",
      );
    return api.current;
  };
  const updateProject = async (
    action: (
      actor: Backend,
    ) => Promise<
      { __kind__: "ok"; ok: unknown } | { __kind__: "err"; err: string }
    >,
    success: string,
  ): Promise<boolean> => {
    const owner = session.current;
    try {
      const actor = requireActor();
      setBusy(true);
      const result = await action(actor);
      if (result.__kind__ === "err") throw new Error(result.err);
      const updated = await actor.listProjects();
      if (session.current !== owner) return false;
      setLiveProjects(updated);
      notify(success);
      return true;
    } catch (error) {
      notify(errorMessage(error), true);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const assignProject = async (id: string, projectId: string) => {
    await updateProject(
      (actor) =>
        actor.assignCanister(
          validateCanisterId(id),
          projectId === "ungrouped" ? null : BigInt(projectId),
        ),
      "Project membership updated. Workspace totals are unchanged.",
    );
  };
  const refresh = useCallback(
    async (targets: Entry[]) => {
      if (operation.current) return;
      const owner = session.current;
      if (!owner || demo || !api.current) {
        notify("Sign in and open your workspace to refresh live status.", true);
        return;
      }
      operation.current = true;
      setBusy(true);
      const actor = api.current;
      const failures: string[] = [];
      try {
        for (const entry of targets) {
          if (session.current !== owner) break;
          const result = await actor.refreshCanister(entry.id);
          if (result.__kind__ === "err")
            failures.push(`${entry.name}: ${result.err}`);
          const updated = await actor.listCanisters();
          if (session.current === owner) setLive(updated);
          if (targets.length > 1)
            await new Promise((resolve) => setTimeout(resolve, 1100));
        }
        if (session.current === owner)
          notify(
            failures.length
              ? `${failures.length} refresh${failures.length > 1 ? "es" : ""} unavailable. ${failures[0]}`
              : "On-chain status updated.",
            failures.length > 0,
          );
      } catch (error) {
        if (session.current === owner) notify(errorMessage(error), true);
      } finally {
        operation.current = false;
        setBusy(false);
      }
    },
    [demo, notify],
  );
  useEffect(() => {
    if (!autoRefresh || demo || !principal) return;
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !operation.current &&
        live.length
      )
        void refresh(live);
    }, 60_000);
    return () => clearInterval(timer);
  }, [autoRefresh, demo, principal, live, refresh]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setAddError("");
    let id;
    try {
      id = validateCanisterId(addId);
    } catch {
      setAddError(
        "That ID is not a valid canister principal. Check its checksum and hyphens.",
      );
      return;
    }
    if (!addName.trim()) {
      setAddError("Give your canister a name.");
      return;
    }
    const owner = session.current;
    try {
      const actor = requireActor();
      setBusy(true);
      const result = await actor.addCanisterInProject(
        id,
        addName.trim(),
        addProject === "ungrouped" ? null : BigInt(addProject),
      );
      if (result.__kind__ === "err") throw new Error(result.err);
      const [updated, updatedProjects] = await Promise.all([
        actor.listCanisters(),
        actor.listProjects(),
      ]);
      if (session.current !== owner) return;
      setLive(updated);
      setLiveProjects(updatedProjects);
      setAddOpen(false);
      setAddName("");
      setAddId("");
      notify(
        "Canister added on-chain. Enable status-viewer access, then refresh.",
      );
    } catch (error) {
      setAddError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (entry: Entry) => {
    const owner = session.current;
    try {
      const actor = requireActor();
      setBusy(true);
      const result = await actor.removeCanister(entry.id);
      if (result.__kind__ === "err") throw new Error(result.err);
      const [updated, updatedProjects] = await Promise.all([
        actor.listCanisters(),
        actor.listProjects(),
      ]);
      if (session.current !== owner) return;
      setLive(updated);
      setLiveProjects(updatedProjects);
      setSelectedId(undefined);
      notify(
        "Removed from your watchlist. The canister itself was not changed.",
      );
    } catch (error) {
      notify(errorMessage(error), true);
    } finally {
      setBusy(false);
    }
  };
  const openAdd = () => {
    setAddError("");
    setAddProject(
      projects.some((project) => project.id.toString() === scope)
        ? scope
        : "ungrouped",
    );
    setAddOpen(true);
  };
  const showAlerts = () => {
    setView("Canisters");
    setFilter("All statuses");
    setQuery("");
    if (!attention.length) notify("No canisters currently need attention.");
    else
      notify(
        `${attention.length} canisters need attention. Open a canister to inspect its status.`,
        true,
      );
  };
  const latest = snapshots.reduce(
    (at, snapshot) => (snapshot.at > at ? snapshot.at : at),
    0n,
  );
  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          href="#"
          className="brand"
          onClick={(event) => {
            event.preventDefault();
            switchView("Overview");
          }}
        >
          <OrbitMark />
          <span>
            orbit<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-picker">
          <div className="workspace-avatar">
            <Boxes size={17} />
          </div>
          <div>
            <strong>{demo ? "Demo workspace" : "My workspace"}</strong>
            <span>
              {demo ? "Explore the possibilities" : "Your Internet Computer"}
            </span>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.title}
              onClick={() => switchView(item.title)}
              className={`nav-item ${view === item.title ? "active" : ""}`}
            >
              <item.icon size={18} />
              <span>{item.title}</span>
              {item.title === "Canisters" && (
                <span className="nav-count">{entries.length}</span>
              )}
              {view === item.title && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="built-card">
            <span className="built-icon">
              <Sparkles size={17} />
            </span>
            <strong>
              Small canisters.
              <br />
              Big possibilities.
            </strong>
            <p>Your corner of the decentralized internet, in one clear view.</p>
            <a
              href="https://docs.internetcomputer.org"
              target="_blank"
              rel="noreferrer"
            >
              Explore ICP <ArrowUpRight size={14} />
            </a>
            <div className="built-orbits" />
          </div>
          <button className="nav-item" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={18} />
            <span>Help & resources</span>
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-network">
            <i />
            <span>{demo ? "Demo preview" : networkName}</span>
            <span className="network-protocol">ICP</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={16} />
              <input
                aria-label="Search canisters"
                placeholder="Search canisters…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (view === "Settings") setView("Canisters");
                }}
              />
              <span>
                <Command size={11} /> K
              </span>
            </label>
            <button
              className="icon-button notification-button"
              aria-label={`${attention.length} canisters need attention`}
              onClick={showAlerts}
            >
              <Bell size={18} />
              {!!attention.length && <i />}
            </button>
            <div className="topbar-divider" />
            {principal ? (
              <button
                className="account-button"
                onClick={() =>
                  void auth
                    .signOut()
                    .catch((error) => notify(errorMessage(error), true))
                }
                title="Sign out"
              >
                <span className="account-avatar">II</span>
                <span>{principal.slice(0, 7)}…</span>
                <LogOut size={14} />
              </button>
            ) : (
              <button
                className="button secondary login-button"
                onClick={signIn}
                disabled={signingIn}
              >
                <Fingerprint size={16} />
                {signingIn ? "Connecting…" : "Connect identity"}
              </button>
            )}
          </div>
        </header>
        <main>
          <div className={`workspace-banner ${demo ? "demo-banner" : ""}`}>
            <div>
              <span className="banner-dot" />
              {demo ? (
                <>
                  <strong>You’re exploring a demo.</strong>
                  <span>
                    All balances, statuses, and charts are sample data.
                  </span>
                </>
              ) : (
                <>
                  <strong>{networkName}</strong>
                  <span>
                    {principal
                      ? "Private watchlist · on-chain storage"
                      : "Sign in to create your on-chain watchlist."}
                  </span>
                </>
              )}
            </div>
            <button
              className="text-button"
              onClick={() => {
                setDemo(!demo);
                setScope("all");
                setChartId("");
                setSelectedId(undefined);
                setFilter("All statuses");
              }}
            >
              {demo ? "Open my workspace" : "Explore demo"}
              <ArrowRight size={14} />
            </button>
          </div>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-orbit" /> YOUR INTERNET COMPUTER, IN FOCUS
              </div>
              <h1>
                {view === "Overview" ? (
                  <>
                    Your canisters.
                    <br className="mobile-break" /> <span>In clear view.</span>
                  </>
                ) : view === "Cycle analytics" ? (
                  <>
                    Every cycle. <span>Accounted for.</span>
                  </>
                ) : view === "Canisters" ? (
                  <>
                    A home for <span>every canister.</span>
                  </>
                ) : (
                  <>
                    Make yourself <span>at home.</span>
                  </>
                )}
              </h1>
              <p>
                {view === "Settings"
                  ? "Your identity, monitoring preferences, and read-only access."
                  : "Monitor cycles, keep an eye on health, and stay a step ahead."}
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="button secondary"
                disabled={
                  demo || busy || loading || !principal || !entries.length
                }
                onClick={() => void refresh(entries)}
              >
                <RefreshCw size={15} className={busy ? "spinning" : ""} />
                <span>{busy ? "Refreshing…" : "Refresh all"}</span>
              </button>
              <button className="button primary" onClick={openAdd}>
                <Plus size={17} />
                Add canister
              </button>
            </div>
          </section>
          {view === "Settings" ? (
            <Settings
              principal={principal}
              autoRefresh={autoRefresh}
              setAutoRefresh={setAutoRefresh}
              notify={notify}
            />
          ) : (
            <>
              <section className="stats-grid" aria-label="Workspace statistics">
                <div className="glass stat-card">
                  <div className="stat-top">
                    <span>Total cycle balance</span>
                    <span className="stat-icon mint">
                      <Zap size={17} />
                    </span>
                  </div>
                  <div className="stat-value">
                    {snapshots.length
                      ? cycles(totalCycles).replace(" T", "")
                      : "—"}
                    <span>T cycles</span>
                  </div>
                  <div className="stat-foot">
                    <span className="mint-text">
                      <Wallet size={12} /> Available fuel
                    </span>
                    <span>
                      {snapshots.length}/{entries.length} reported
                    </span>
                  </div>
                  <div className="stat-glow mint-glow" />
                </div>
                <div className="glass stat-card">
                  <div className="stat-top">
                    <span>Canisters tracked</span>
                    <span className="stat-icon blue">
                      <Boxes size={17} />
                    </span>
                  </div>
                  <div className="stat-value">
                    {entries.length.toString().padStart(2, "0")}
                    <span>canisters</span>
                  </div>
                  <div className="stat-foot">
                    <span className="mint-text">
                      <i className="status-dot" />
                      {
                        entries.filter((entry) => health(entry) === "Healthy")
                          .length
                      }{" "}
                      healthy
                    </span>
                    <span>in this workspace</span>
                  </div>
                </div>
                <div className="glass stat-card">
                  <div className="stat-top">
                    <span>Idle burn / day</span>
                    <span className="stat-icon purple">
                      <Activity size={17} />
                    </span>
                  </div>
                  <div className="stat-value">
                    {snapshots.length
                      ? cycles(totalBurn).replace(" T", "")
                      : "—"}
                    <span>T cycles</span>
                  </div>
                  <div className="stat-foot">
                    <span>
                      <ArrowDownRight size={13} /> Storage & allocation
                    </span>
                    <span>excludes execution</span>
                  </div>
                </div>
                <button
                  className="glass stat-card attention-card"
                  onClick={showAlerts}
                >
                  <div className="stat-top">
                    <span>Needs attention</span>
                    <span className="stat-icon amber">
                      <TriangleAlert size={17} />
                    </span>
                  </div>
                  <div className="stat-value">
                    {attention.length.toString().padStart(2, "0")}
                    <span>canisters</span>
                  </div>
                  <div className="stat-foot">
                    <span
                      className={attention.length ? "amber-text" : "mint-text"}
                    >
                      {attention.length
                        ? "A little care goes a long way"
                        : "Looking good"}
                    </span>
                    <ArrowUpRight size={15} />
                  </div>
                </button>
              </section>
              <Projects
                entries={entries}
                projects={projects}
                scope={scope}
                onScope={(next) => {
                  setScope(next);
                  setChartId("");
                  setQuery("");
                  setFilter("All statuses");
                }}
                demo={demo}
                busy={busy || loading || !principal}
                onSave={async (id, name) =>
                  updateProject(
                    (actor) =>
                      id === null
                        ? actor.createProject(name)
                        : actor.renameProject(id, name),
                    id === null
                      ? "Project created on-chain."
                      : "Project renamed.",
                  )
                }
                onDelete={async (id) => {
                  const deleted = await updateProject(
                    (actor) => actor.deleteProject(id),
                    "Project deleted. Its canisters are now Ungrouped; history is preserved.",
                  );
                  if (deleted) setScope("ungrouped");
                  return deleted;
                }}
                onAssign={assignProject}
                onRefresh={(targets) => void refresh(targets)}
              />
              {view !== "Canisters" && (
                <div className="insights-grid">
                  <section className="glass chart-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>
                          <span className="chart-symbol">
                            <ChartNoAxesCombined size={17} />
                          </span>
                          Cycle balance · {scopeName}
                        </h2>
                        <p>On-chain snapshots. A clearer picture over time.</p>
                      </div>
                      <div className="range-switch" aria-label="History range">
                        {["24h", "7d", "30d"].map((item) => (
                          <button
                            key={item}
                            className={range === item ? "active" : ""}
                            onClick={() => setRange(item)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="chart-summary">
                      <strong>
                        {chartEntry?.snapshot
                          ? cycles(chartEntry.snapshot.details.cycles)
                          : !chartEntry && scopeSummary.reported
                            ? cycles(scopeSummary.cycles)
                            : "—"}
                        <span>available cycles</span>
                      </strong>
                      <label className="chart-select">
                        <span className="legend-dot" />
                        <select
                          aria-label="Chart canister"
                          value={chartEntry?.id.toText() ?? ""}
                          onChange={(event) => setChartId(event.target.value)}
                        >
                          <option value="">Combined scope balance</option>
                          {scopedEntries.length
                            ? scopedEntries.map((entry) => (
                                <option
                                  key={entry.id.toText()}
                                  value={entry.id.toText()}
                                >
                                  {entry.name}
                                </option>
                              ))
                            : null}
                        </select>
                      </label>
                    </div>
                    <CycleChart points={chartPoints} />
                    <div className="chart-bottom">
                      <span>
                        <i className="legend-dot" />
                        {demo
                          ? "Illustrative sample history"
                          : chartEntry
                            ? `${chartPoints.length} recorded samples · latest 60 retained`
                            : "Sum of last-known samples · starts when all members have history"}
                      </span>
                      <span>Cycles, not tokens</span>
                    </div>
                  </section>
                  <section className="glass network-card">
                    <div className="network-card-heading">
                      <span className="network-pill">
                        <i />
                        {demo ? "DEMO EXPLORER" : "ON-CHAIN WORKSPACE"}
                      </span>
                      <ArrowUpRight size={17} />
                    </div>
                    <div className="orbital-art" aria-hidden="true">
                      <div className="orbital-halo" />
                      <div className="orbit-ring ring-one" />
                      <div className="orbit-ring ring-two" />
                      <div className="orbit-ring ring-three" />
                      <div className="orbital-core">
                        <span>∞</span>
                      </div>
                      <span className="orbit-node node-one" />
                      <span className="orbit-node node-two" />
                      <span className="orbit-node node-three" />
                      <span className="orbit-cross">+</span>
                    </div>
                    <div className="network-copy">
                      <span className="eyebrow">
                        BUILT DIFFERENT. BUILT ON ICP.
                      </span>
                      <h2>
                        Your infrastructure.
                        <br />
                        <span>No blind spots.</span>
                      </h2>
                      <p>
                        From cycles to controllers, get closer to what powers
                        your app.
                      </p>
                    </div>
                    <div className="network-bottom">
                      <Globe2 size={15} />
                      <span>{demo ? "Internet Computer" : networkName}</span>
                      <span className="network-chip">∞</span>
                    </div>
                  </section>
                </div>
              )}
              {view === "Cycle analytics" && (
                <div className="inline-notice">
                  <Activity size={18} />
                  <span>
                    <strong>
                      {snapshots.length ? bytes(totalMemory) : "No"} total
                      reported memory.
                    </strong>{" "}
                    Charts show observations collected when you refresh, not
                    continuous telemetry. Idle burn excludes execution costs,
                    and top-ups can increase balances.
                  </span>
                </div>
              )}
              <section className="glass canisters-panel">
                <div className="table-heading">
                  <div>
                    <h2>
                      {scope === "all" ? "Your canisters" : scopeName}{" "}
                      <span className="count-pill">{scopedEntries.length}</span>
                    </h2>
                    <p>A little oversight. A lot of peace of mind.</p>
                  </div>
                  <button
                    className="text-button export-button"
                    disabled={!scopedEntries.length}
                    onClick={() =>
                      download("orbit-workspace.json", {
                        source: demo ? "demo" : "ic-network-snapshots",
                        exportedAt: new Date().toISOString(),
                        scope: scopeName,
                        projects,
                        canisters: scopedEntries,
                      })
                    }
                  >
                    <Download size={14} />
                    Export
                  </button>
                </div>
                <div className="table-toolbar">
                  <label className="table-search">
                    <Search size={15} />
                    <input
                      ref={searchInput}
                      aria-label="Filter watchlist"
                      placeholder="Find a canister by name or ID…"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    {query && (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <div className="table-filters">
                    <label className="status-select">
                      <span className="filter-dot" />
                      <select
                        aria-label="Filter by status"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                      >
                        {[
                          "All statuses",
                          "Healthy",
                          "Low cycles",
                          "Stopped",
                          "Stopping",
                          "Needs access",
                          "Unavailable",
                          "Not synced",
                          "Stale",
                        ].map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <div className="view-switch">
                      <button
                        aria-label="Table view"
                        aria-pressed={!grid}
                        className={!grid ? "active" : ""}
                        onClick={() => setGrid(false)}
                      >
                        <List size={16} />
                      </button>
                      <button
                        aria-label="Card view"
                        aria-pressed={grid}
                        className={grid ? "active" : ""}
                        onClick={() => setGrid(true)}
                      >
                        <LayoutGrid size={15} />
                      </button>
                    </div>
                  </div>
                </div>
                {loading && !demo ? (
                  <div className="empty-state">
                    <LoaderCircle className="spinning" size={26} />
                    <h3>Finding your corner of the IC…</h3>
                    <p>Loading your private, on-chain watchlist.</p>
                  </div>
                ) : visible.length ? (
                  grid ? (
                    <div className="canister-grid">
                      {visible.map((entry, index) => (
                        <button
                          className="canister-tile"
                          key={entry.id.toText()}
                          onClick={() => setSelectedId(entry.id.toText())}
                        >
                          <div className={`canister-icon color-${index % 5}`}>
                            <Box size={20} />
                          </div>
                          <h3>{entry.name}</h3>
                          <code>{entry.id.toText()}</code>
                          <span
                            className={`badge ${health(entry).toLowerCase().replaceAll(" ", "-")}`}
                          >
                            <i />
                            {health(entry)}
                          </span>
                          <div className="tile-balance">
                            {entry.snapshot
                              ? cycles(entry.snapshot.details.cycles)
                              : "No snapshot"}
                          </div>
                          <Sparkline
                            points={entry.history}
                            warning={health(entry) === "Low cycles"}
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>CANISTER</th>
                            <th>STATUS</th>
                            <th>
                              CYCLE BALANCE <ChevronDown size={11} />
                            </th>
                            <th>MEMORY</th>
                            <th>RECENT TREND</th>
                            <th aria-label="View details" />
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((entry, index) => (
                            <tr key={entry.id.toText()}>
                              <td>
                                <button
                                  className="canister-name-button"
                                  onClick={() =>
                                    setSelectedId(entry.id.toText())
                                  }
                                >
                                  <span
                                    className={`canister-icon color-${index % 5}`}
                                  >
                                    <Box size={18} />
                                  </span>
                                  <span>
                                    <strong>{entry.name}</strong>
                                    <code>{entry.id.toText()}</code>
                                  </span>
                                </button>
                              </td>
                              <td>
                                <span
                                  className={`badge ${health(entry).toLowerCase().replaceAll(" ", "-")}`}
                                >
                                  <i />
                                  {health(entry)}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`balance-cell ${health(entry) === "Low cycles" ? "amber-text" : ""}`}
                                  title={entry.snapshot?.details.cycles.toLocaleString()}
                                >
                                  {entry.snapshot
                                    ? cycles(entry.snapshot.details.cycles)
                                    : "—"}
                                </span>
                                <span className="cell-caption">
                                  {entry.snapshot
                                    ? `Updated ${timeAgo(entry.snapshot.at)}`
                                    : "Refresh to connect"}
                                </span>
                              </td>
                              <td>
                                <span className="memory-cell">
                                  {entry.snapshot
                                    ? bytes(entry.snapshot.details.memory_size)
                                    : "—"}
                                </span>
                              </td>
                              <td>
                                <Sparkline
                                  points={entry.history}
                                  warning={health(entry) === "Low cycles"}
                                />
                              </td>
                              <td>
                                <button
                                  className="icon-button row-arrow"
                                  aria-label={`View ${entry.name}`}
                                  onClick={() =>
                                    setSelectedId(entry.id.toText())
                                  }
                                >
                                  <ArrowUpRight size={17} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <div className="empty-state">
                    <span className="empty-box">
                      <Boxes size={29} />
                    </span>
                    <h3>
                      {scopedEntries.length
                        ? "No canisters match your search."
                        : "Your next big idea belongs here."}
                    </h3>
                    <p>
                      {scopedEntries.length
                        ? "Try another name, ID, or status filter."
                        : scope !== "all"
                          ? "Add a canister to this project, or move one here from its details panel."
                          : principal
                            ? "Add your first canister to start your on-chain watchlist."
                            : "Connect Internet Identity to save canisters and start monitoring."}
                    </p>
                    {scopedEntries.length ? (
                      <button
                        className="button secondary"
                        onClick={() => {
                          setQuery("");
                          setFilter("All statuses");
                        }}
                      >
                        Clear filters
                      </button>
                    ) : (
                      <button
                        className="button primary"
                        onClick={principal ? openAdd : signIn}
                      >
                        {principal ? (
                          <Plus size={16} />
                        ) : (
                          <Fingerprint size={16} />
                        )}
                        {principal
                          ? "Add your first canister"
                          : "Connect identity"}
                      </button>
                    )}
                  </div>
                )}
                <div className="table-footer">
                  <span>
                    Showing {visible.length} of {scopedEntries.length} in scope
                    · {entries.length} workspace total
                  </span>
                  <span>
                    <ShieldCheck size={13} />
                    {demo
                      ? "Sample data · not live network status"
                      : latest
                        ? `Latest snapshot ${timeAgo(latest)}`
                        : "Your watchlist, stored on-chain"}
                  </span>
                </div>
              </section>
              <div className="permission-note">
                <ShieldCheck size={15} />
                <span>
                  Good to know: cycle balances and detailed status require
                  permission unless the canister makes status public.
                </span>
                <button
                  className="text-button"
                  onClick={() => switchView("Settings")}
                >
                  Set up monitoring <ArrowRight size={13} />
                </button>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>
              <OrbitMark />A little clarity for your corner of the internet.
            </span>
            <span>
              Crafted for the Internet Computer{" "}
              <span className="footer-star">✧</span>
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? "error-toast" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <TriangleAlert size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast(undefined)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {addOpen && (
        <Modal
          title="A new canister, in your orbit."
          onClose={() => setAddOpen(false)}
        >
          <p className="dialog-description">
            Paste a canister ID. Give it a name. We’ll take it from here.
          </p>
          <form onSubmit={(event) => void add(event)}>
            <label className="field-label" htmlFor="canister-name">
              Canister name
            </label>
            <input
              id="canister-name"
              className="form-input"
              placeholder="e.g. My app backend"
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
              maxLength={80}
              required
              autoFocus
            />
            <label className="field-label" htmlFor="canister-id">
              Canister ID
            </label>
            <input
              id="canister-id"
              className="form-input mono"
              placeholder="xxxxx-xxxxx-xxxxx-xxxxx-cai"
              value={addId}
              onChange={(event) => setAddId(event.target.value)}
              required
            />
            <p className="muted small">
              A principal ID on {networkName}. Adding a canister does not grant
              access or modify it.
            </p>
            <label className="field-label" htmlFor="canister-project">
              Project
            </label>
            <select
              id="canister-project"
              className="form-input"
              value={addProject}
              onChange={(event) => setAddProject(event.target.value)}
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
            {(demo || !principal) && (
              <div className="inline-notice">
                <Fingerprint size={18} />
                <div>
                  Connect your identity and open your workspace to save
                  canisters on-chain.
                  <div className="inline-actions">
                    {!principal && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={signIn}
                        disabled={signingIn}
                      >
                        Connect identity <ArrowRight size={13} />
                      </button>
                    )}
                    {principal && demo && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setDemo(false);
                          setScope("all");
                          setChartId("");
                          setAddProject("ungrouped");
                        }}
                      >
                        Use my workspace <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
            {addError && (
              <p className="form-error" role="alert">
                {addError}
              </p>
            )}
            <div className="form-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </button>
              <button
                className="button primary"
                type="submit"
                disabled={busy || loading}
              >
                <Plus size={16} />
                {busy ? "Saving on-chain…" : "Add canister"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <CanisterDetails
          key={selected.id.toText()}
          entry={selected}
          demo={demo}
          busy={busy}
          onClose={() => setSelectedId(undefined)}
          onRefresh={() => void refresh([selected])}
          onRemove={() => void remove(selected)}
          onSetup={() => {
            setSelectedId(undefined);
            switchView("Settings");
          }}
          notify={notify}
          projects={projects}
          projectId={
            projectFor(projects, selected.id.toText())?.id.toString() ??
            "ungrouped"
          }
          onAssign={(projectId) =>
            void assignProject(selected.id.toText(), projectId)
          }
        />
      )}
      {helpOpen && (
        <Modal
          title="A clearer way to navigate ICP."
          onClose={() => setHelpOpen(false)}
        >
          <p className="dialog-description">
            Orbit is a monitoring-only dashboard. Start by connecting your
            identity, adding a canister, and enabling read-only status access.
          </p>
          <div className="help-links">
            <button
              onClick={() => {
                setHelpOpen(false);
                switchView("Settings");
              }}
            >
              <ShieldCheck size={21} />
              <div>
                <strong>Monitoring setup</strong>
                <span>Read-only status access & your workspace</span>
              </div>
              <ArrowRight size={16} />
            </button>
            <a
              href="https://docs.internetcomputer.org"
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen size={21} />
              <div>
                <strong>Internet Computer documentation</strong>
                <span>Learn about canisters, cycles, and the IC</span>
              </div>
              <ExternalLink size={16} />
            </a>
            <a
              href="https://dashboard.internetcomputer.org"
              target="_blank"
              rel="noreferrer"
            >
              <Globe2 size={21} />
              <div>
                <strong>ICP network dashboard</strong>
                <span>Public subnet and network information</span>
              </div>
              <ExternalLink size={16} />
            </a>
          </div>
          <p className="muted small">
            No keys, tokens, or transfers are requested. Your on-chain watchlist
            is separate from the sample demo. History is collected on demand,
            not in the background when the app is closed.
          </p>
        </Modal>
      )}
    </div>
  );
}
