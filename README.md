# Orbit — Canister Manager

A glassmorphism dashboard for the Internet Computer. React + TypeScript frontend,
Internet Identity authentication, and a Motoko monitoring backend. Both frontend
and backend deploy as ICP canisters; no centralized application server is needed.

## What works

- Add canisters by principal ID, with checksum validation and friendly names.
- Private on-chain watchlists, isolated by the authenticated caller.
- On-chain projects with one project per canister and an Ungrouped section.
  Create, rename, delete, and move canisters between projects. Deleting a project
  never deletes its canisters, snapshots, or cycle history.
- Project-level cycles, idle burn, memory, health, snapshot coverage, refresh,
  scoped search/export, and combined balance history. Workspace totals stay
  visible and always count every tracked canister once.
- Cycle balance, reserved cycles, idle burn, runtime status, memory, controllers,
  module hash, freezing threshold, allocations, memory limits, log visibility,
  status/snapshot visibility, canister version, migration readiness, query
  statistics, and memory breakdown when reported by the replica.
- Latest 60 cycle observations per tracked canister, persisted across upgrades.
- Certified public metadata: controllers, module hash, published Candid interface,
  certificate subnet, and network time.
- Search, status filters, table/card views, per-canister inspector, JSON export
  with exact integer balances, and optional visible-tab auto-refresh.
- Responsive dark glass UI, self-hosted fonts, keyboard-accessible dialogs,
  reduced-motion support, and Ctrl/Cmd+K search.
- Explicitly labeled, read-only demo workspace. **Demo values are invented, not
  actual balances or health of the named public canisters.**

## Layout

Flat ICP layout: `icp.yaml` lists `canisters/*`.

- `canisters/backend/` — Motoko canister (`mops.toml`, `src/`, `test/`, `deployed/`)
- `canisters/frontend/` — React + Vite static site (`app/`, `public/`, `tests/`)

The root `package.json` only delegates to the canister folders.

## Run locally

Requires Node.js 22.16+, `icp`, `ic-wasm`, and `mops`.

```sh
npm run install:all   # npm ci in canisters/frontend, mops install in canisters/backend
icp network start
```

In another terminal:

```sh
icp deploy -y --identity anonymous
```

Open **http://frontend.local.localhost:8001**. The project uses port 8001 so it
doesn't take over a different project's default port. Stop the foreground
network with Ctrl+C when finished.

Internet Identity uses mainnet II (`https://id.ai`) even with the local backend;
its delegation requests explicitly use `https://icp-api.io` with mainnet trust,
while backend and metadata requests use the dashboard origin and its `ic_env`
root key. This keeps local requests same-origin under the production CSP.
The managed local network accepts II's delegations. Your principal is specific to
the app origin, so moving to another origin may require granting access again.
There is no need to enter your deployment identity password into the dashboard.

For UI-only development, `npm run dev` starts Vite.
The demo works there. **Live calls require the `ic_env` cookie from the
ICP-hosted frontend**; use the deployed frontend for end-to-end testing.
Canister IDs and the local root key are read from that cookie, not baked into
the build. The app never calls `fetchRootKey()` or disables certificate checks.

For encrypted CLI identities, append
`--identity-password-file "$HOME/.identity-pw"` to deployment commands rather
than printing or putting the password into an argument.

If Node tools fail with `SELF_SIGNED_CERT_IN_CHAIN` or `CERT_SIGNATURE_FAILURE`
behind a TLS-inspecting proxy, point `NODE_EXTRA_CA_CERTS` at the proxy's root CA.
Do not disable TLS verification.

## Read-only monitoring setup

Adding an ID only adds it to your watchlist. **Cycle balances and detailed status
are restricted by default**, but the current IC supports `status_visibility`:
`controllers`, `allowed_viewers`, or `public`. Orbit supports all three and
recommends granting **read-only status-viewer access**, not controller access.
The backend and the signed-in user must each be permitted to read the target's
status. Permission to call the backend alone is not permission to read a target.

1. Sign in, add a canister, and open **Settings**.
2. Copy the backend ID and your signed-in principal.
3. If status is not already public, use an existing controller identity to add
   **both** as status viewers with `--add-status-viewer`. Settings provides the
   exact CLI command. Existing controllers and other viewers are preserved.
4. Refresh the canister. Insufficient permissions and network failures are shown
   explicitly; failed refreshes never manufacture a healthy state.

Status viewers **cannot upgrade or delete** a canister. On older replicas that
lack `status_visibility`, controller access remains a powerful fallback; only
use a backend whose operator and upgrade policy you control. A backend operator
can upgrade its code and exercise any privileges you granted to that backend.
Removing a watchlist entry does **not** revoke network-level permissions; revoke
those separately with the CLI. Keep a backup controller for your own canisters.

Accounts retain their previously authorized historical observations. Revoking a
user as a status viewer/controller cannot erase data they already obtained. A subsequent
successful status call that finds that user unauthorized clears that entry's
cached details/history and returns an access error. A rejected management call
retains the last snapshot explicitly marked with its timestamp and error.

“Private” here means application-level access isolation, not encryption against
subnet operators. Query reads are replica-signed, not application-certified;
refresh updates and public `read_state` metadata are certificate-verified.

## Monitoring semantics and limits

- Projects are private to the authenticated caller and persist across upgrades.
  Existing watchlists start Ungrouped. Up to 20 projects per account; existing
  limits of 20 tracked canisters/account and 100 accounts/deployment still apply.
- Select a project card to scope the canister list, export, and analytics.
  Use the pencil to rename a project or manage membership, or change the project
  directly in a canister's detail panel. The add-canister dialog defaults to the
  selected project and saves the canister and its membership atomically.
- Project/workspace sums use the latest available snapshots, which may have
  different timestamps or be stale; coverage and attention counts are explicit.
  Missing snapshots are excluded from sums, not treated as actual zero balances.
  The combined chart sums last-known historical observations and starts only
  after every scoped canister has a sample. It is not synchronized telemetry.

- This is a monitoring-only MVP, not a lifecycle or wallet manager. There are no
  stop, delete, upgrade, controller-edit, or transfer endpoints.
- History starts when you refresh. No backfilled or continuous historical data
  is available from the standard status API. Auto-refresh runs only while a
  signed-in, visible browser tab is open; it is off by default.
- “Idle burn” covers storage/allocation, **not execution or traffic**. Idle runway
  is not an exhaustion or freezing prediction. Low-cycle guidance means under
  1T cycles or under seven days of reported idle burn. A snapshot older than five
  minutes is marked stale, not healthy.
- Up to 20 canisters/account and 100 accounts/deployment; 60 samples/canister.
  Refreshes are limited to one/target/minute, one/user/second, 120/deployment/minute,
  and four outstanding calls. Cross-canister calls have a 20-second bounded wait.
  Storage and outgoing calls are bounded, but a public service is not Sybil-proof:
  operate a production deployment with an appropriate admission/funding policy.
- Local replicas only monitor local IDs. Mainnet deployments monitor mainnet IDs.
- Unpublished Candid or fields not exposed by the replica are unavailable, not zero.
- Environment variables, Wasm code, private application state, arbitrary app
  metrics, canister logs, change history, and snapshots are not collected by this
  version. Logs and management history have additional APIs and permissions.

## Validate

```sh
npm test
npm run test:backend
npm run check:backend
npm run build
# After local deployment; mutates only the managed local test network:
npm run test:integration
```

The integration test uses disposable identities and temporary **status viewers**,
not controllers, tests real status and certified metadata, upgrades the backend
to verify persistence, and removes those temporary permissions. It refuses
mainnet and remote networks. For an encrypted CLI identity, pass a password file
without printing its contents:

```sh
ICP_IDENTITY_PASSWORD_FILE="$HOME/.identity-pw" npm run test:integration
```

`npm run generate` regenerates `canisters/backend/src/backend.did` from Motoko.
Vite's `@icp-sdk/bindgen` plugin regenerates typed frontend bindings from that
interface. Commit source, Candid, `mops.lock`, and `package-lock.json`; generated
TypeScript bindings and build caches are ignored.
After a backend deployment, run `mops deployed backend` in `canisters/backend/` to update the committed
stable-type baseline used by `mops check`. Applied migration files are immutable.

## Mainnet deployment

Review the status-viewer permissions and production admission policy first. Use a
funded, named deployment identity; do not use the anonymous identity on mainnet.

```sh
icp deploy -e ic --identity <YOUR_IDENTITY>
```

This spends real cycles. Preserve the resulting `.icp/data/` mappings. Add a backup
controller and monitor the Orbit backend's own cycles. The certified static-site
recipe serves the frontend at `https://<frontend-canister-id>.icp.net`.

## Research and architecture decisions

Official documentation consulted for this implementation:

- [ICP skills index](https://skills.internetcomputer.org/.well-known/skills/index.json)
  — current platform and SDK conventions.
- [Management canister reference](https://docs.internetcomputer.org/references/management-canister/)
  — current `status_visibility` and read-only viewer permissions.
- [IC interface specification](https://docs.internetcomputer.org/references/ic-interface-spec/management-canister/)
  — management status permissions and certified state.
- [Cycles management](https://skills.internetcomputer.org/.well-known/skills/cycles-management/SKILL.md)
  — cycle accounting, freezing, and funding distinctions.
- [Internet Identity](https://skills.internetcomputer.org/.well-known/skills/internet-identity/SKILL.md)
  — `@icp-sdk/auth` 11 with `@icp-sdk/core` 6, app-specific principals, and sessions.
- [Canister security](https://skills.internetcomputer.org/.well-known/skills/canister-security/SKILL.md)
  — protocol caller checks, bounded calls, storage limits, and async safety.
- [Motoko](https://skills.internetcomputer.org/.well-known/skills/writing-motoko/SKILL.md)
  and [migration chains](https://skills.internetcomputer.org/.well-known/skills/migrating-motoko-actors/SKILL.md)
  — enhanced persistence with explicit initial-state migration.
- [Static-site hosting](https://skills.internetcomputer.org/.well-known/skills/static-site/SKILL.md)
  — certified frontend assets and cookie-based environment discovery.

The backend architecture was selected to provide on-chain watchlists and history.
Viewer/controller authorization is checked from network-returned status, not a
frontend-provided principal. Mutations are caller-isolated; callbacks re-read
current state and check attempt identity so late responses cannot resurrect a
removed/re-added entry. The UI never stores or requests deployment keys.
