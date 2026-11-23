---
paths:
  - "canisters/backend/**"
---

# Backend canister rules

- Every mutation and read is isolated by authenticated caller; reject anonymous.
- Authorization to read a target's status comes from the network-returned status,
  never from a frontend-supplied principal.
- Keep the storage and call limits bounded: 20 tracked canisters and 20 projects
  per account, 100 accounts per deployment, 60 history samples per canister;
  refresh at most once per target per minute, once per user per second,
  120 per deployment per minute, 4 outstanding calls; 20 s bounded-wait calls.
- Callbacks re-read current state and check the attempt identity so late
  responses can't resurrect a removed or re-added entry.
- Deleting a project never deletes its canisters, snapshots or history.
- After a local backend deploy, run `mops deployed backend` here to refresh
  `deployed/backend.most`.
