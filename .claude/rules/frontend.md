---
paths:
  - "canisters/frontend/**"
---

# Frontend canister rules

- Canister IDs and the local root key come from the `ic_env` cookie
  (`PUBLIC_CANISTER_ID:backend`), never baked into the build. Never call
  `fetchRootKey()` or disable certificate checks.
- Internet Identity is mainnet II (`https://id.ai`); delegation requests use
  `https://icp-api.io` with mainnet trust; backend and metadata calls use the
  page origin (same-origin under the CSP in `public/_headers`).
- The demo workspace is read-only and labeled as invented data; never present
  demo values as real balances or health.
- Missing or stale snapshots are shown as unavailable/stale, never as zero or
  healthy.
