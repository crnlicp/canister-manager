@~/.claude/icp/RULES.md

# Orbit — Canister Manager

Monitoring-only dashboard for Internet Computer canisters: private per-user
watchlists, projects, cycle/status history and certified metadata. Not a
lifecycle or wallet manager: no stop/delete/upgrade/controller/transfer endpoints.

## Layout: flat

| Canister   | Folder                | Stack                                   |
|------------|-----------------------|-----------------------------------------|
| `backend`  | `canisters/backend/`  | Motoko, recipe `@dfinity/motoko@v5.0.0` |
| `frontend` | `canisters/frontend/` | React + plain Vite (`app/`), recipe `@dfinity/static-site@v0.4.0`, output `dist/` |

- npm (not pnpm); lockfile is `canisters/frontend/package-lock.json`.
- Candid has one source: `canisters/backend/src/backend.did`. The frontend's
  bindgen plugin reads it by relative path into `app/bindings/` (not committed).
- Local network: managed, gateway port 8001; app at
  `http://frontend.local.localhost:8001`.

## Root commands

- `npm run install:all` — `npm ci` (frontend) + `mops install` (backend)
- `npm run build` / `npm test` / `npm run dev` — frontend
- `npm run check:backend` / `npm run test:backend` / `npm run generate` — backend
- `npm run test:integration` — local-only end-to-end test
  (`canisters/frontend/tests/integration.mjs`); refuses remote networks,
  runs `icp` as `$ICP_IDENTITY` or `anonymous`.
- Local deploy: `icp deploy -y --identity anonymous`

## Boundaries

- Never deploy to mainnet or touch mainnet canisters without explicit approval.
- Status reads use the read-only status-viewer model; never ask users for
  controller access or deployment keys.
