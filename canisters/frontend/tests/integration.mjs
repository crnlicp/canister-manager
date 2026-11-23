import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Actor, HttpAgent, StatePaths } from "@icp-sdk/core/agent";
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity";
import { Principal } from "@icp-sdk/core/principal";
import { idlFactory } from "../app/bindings/declarations/backend.did.js";

// Local runs never use the default (mainnet) identity unless ICP_IDENTITY says so.
const identityArgs = [
  "--identity",
  process.env.ICP_IDENTITY ?? "anonymous",
  ...(process.env.ICP_IDENTITY_PASSWORD_FILE
    ? ["--identity-password-file", process.env.ICP_IDENTITY_PASSWORD_FILE]
    : []),
];
const cli = (...args) =>
  execFileSync(
    "icp",
    [...args, ...(args[0] === "network" ? [] : identityArgs)],
    { encoding: "utf8" },
  );
const network = JSON.parse(cli("network", "status", "--json"));
assert.ok(
  network.managed,
  "Integration tests must only run on a managed local network.",
);
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(network.api_url).hostname),
  "Refusing to mutate a remote network.",
);
const mappings = JSON.parse(
  readFileSync(
    new URL("../../../.icp/cache/mappings/local.ids.json", import.meta.url),
    "utf8",
  ),
);
const backendId = mappings.backend;
const frontendId = mappings.frontend;
assert.equal(typeof backendId, "string", "Deploy backend locally first.");
assert.equal(typeof frontendId, "string", "Deploy frontend locally first.");
const owner = Ed25519KeyIdentity.generate();
const other = Ed25519KeyIdentity.generate();
const create = async (identity) =>
  Actor.createActor(idlFactory, {
    canisterId: backendId,
    agent: await HttpAgent.create({
      identity,
      host: network.api_url,
      rootKey: Uint8Array.from(Buffer.from(network.root_key, "hex")),
    }),
  });
const actor = await create(owner);
const outsider = await create(other);
const anonymous = await create(undefined);
const target = Principal.fromText(frontendId);
const monitor = Principal.fromText(backendId);
const ok = (result) => {
  assert.ok(
    "ok" in result,
    "err" in result ? result.err : "Expected ok result",
  );
  return result.ok;
};
const error = (result, message) => {
  assert.ok("err" in result);
  assert.match(result.err, message);
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await assert.rejects(anonymous.listCanisters(), /Sign in/);
await assert.rejects(
  anonymous.addCanister(target, "Anonymous write"),
  /Sign in/,
);
console.log("PASS anonymous reads and writes rejected");
error(
  await actor.addCanister(Principal.anonymous(), "Invalid"),
  /application canister/,
);
error(await actor.addCanister(target, ""), /1 to 80/);
ok(await actor.addCanister(target, "Integration frontend"));
error(await actor.addCanister(target, "Duplicate"), /already/);
assert.equal((await actor.listCanisters()).length, 1);
assert.equal((await outsider.listCanisters()).length, 0);
error(await outsider.refreshCanister(target), /watchlist first/);
console.log(
  "PASS validation, duplicate handling, and per-caller watchlist isolation",
);
cli("deploy", "backend", "-y");
assert.equal((await actor.listCanisters())[0].name, "Integration frontend");
assert.equal((await actor.listProjects()).length, 0);
console.log(
  "PASS pre-project watchlists survive migration and start Ungrouped",
);
await assert.rejects(anonymous.listProjects(), /Sign in/);
await assert.rejects(anonymous.createProject("Anonymous project"), /Sign in/);
await assert.rejects(anonymous.assignCanister(target, []), /Sign in/);
error(await actor.createProject("   "), /1 to 80/);
error(await actor.createProject("x".repeat(81)), /1 to 80/);
const project = ok(await actor.createProject("Integration project"));
const secondProject = ok(await actor.createProject("Second project"));
assert(secondProject > project);
error(await actor.createProject("Integration project"), /already exists/);
error(await outsider.renameProject(project, "Hijacked"), /not found/);
error(await outsider.deleteProject(project), /not found/);
error(await outsider.assignCanister(target, [project]), /Canister not found/);
assert.equal((await outsider.listProjects()).length, 0);
ok(await actor.assignCanister(target, [project]));
ok(await actor.assignCanister(target, []));
assert(
  (await actor.listProjects()).every((item) => item.canisterIds.length === 0),
);
ok(await actor.assignCanister(target, [project]));
ok(await actor.assignCanister(target, [secondProject]));
let projectList = await actor.listProjects();
assert.equal(
  projectList.find((item) => item.id === project).canisterIds.length,
  0,
);
assert.equal(
  projectList.find((item) => item.id === secondProject).canisterIds.length,
  1,
);
ok(await actor.assignCanister(target, [secondProject]));
assert.equal(
  (await actor.listProjects()).find((item) => item.id === secondProject)
    .canisterIds.length,
  1,
);
error(await actor.assignCanister(target, [999n]), /Project not found/);
error(
  await actor.addCanisterInProject(monitor, "Must not be added", [999n]),
  /Project not found/,
);
assert.equal((await actor.listCanisters()).length, 1);
ok(await actor.renameProject(secondProject, "Renamed project"));
error(
  await actor.renameProject(secondProject, "Integration project"),
  /already exists/,
);
ok(await actor.deleteProject(project));
assert.equal((await actor.listProjects()).length, 1);
console.log(
  "PASS private project CRUD, one-project membership, duplicate prevention, and atomic invalid add",
);

cli(
  "canister",
  "settings",
  "update",
  "frontend",
  "--add-status-viewer",
  backendId,
  "--add-status-viewer",
  owner.getPrincipal().toText(),
  "-f",
);
try {
  const snapshot = ok(await actor.refreshCanister(target));
  assert.ok(snapshot.details.cycles > 0n);
  assert.ok(snapshot.details.memory_size > 0n);
  assert.ok("running" in snapshot.details.status);
  assert.ok(
    !snapshot.details.settings.controllers.some(
      (controller) => controller.toText() === owner.getPrincipal().toText(),
    ),
  );
  assert.ok(
    !snapshot.details.settings.controllers.some(
      (controller) => controller.toText() === backendId,
    ),
  );
  assert.ok(
    snapshot.details.settings.status_visibility[0].allowed_viewers.some(
      (viewer) => viewer.toText() === owner.getPrincipal().toText(),
    ),
  );
  const entries = await actor.listCanisters();
  assert.equal(entries[0].history.length, 1);
  assert.equal(entries[0].snapshot[0].details.cycles, snapshot.details.cycles);
  error(await actor.refreshCanister(target), /60 seconds/);
  console.log(
    "PASS real management status and cooldown using only read-only viewer permissions, not controller access",
  );

  await sleep(1100);
  ok(
    await actor.addCanisterInProject(monitor, "Unauthorized monitor", [
      secondProject,
    ]),
  );
  error(await actor.refreshCanister(monitor), /Access denied/);
  const denied = (await actor.listCanisters()).find(
    (entry) => entry.id.toText() === backendId,
  );
  assert.equal(denied.snapshot.length, 0);
  assert.equal(denied.history.length, 0);
  assert.ok(denied.lastError.length);
  console.log(
    "PASS the backend's own status cannot be disclosed to an unauthorized user",
  );

  const agent = await HttpAgent.create({
    host: network.api_url,
    rootKey: Uint8Array.from(Buffer.from(network.root_key, "hex")),
  });
  const controllers = StatePaths.canisterControllers(target);
  const hash = StatePaths.canisterModuleHash(target);
  const result = await agent.readState(
    { canisterId: target },
    { paths: [controllers, hash] },
  );
  assert.ok(result.values.get(controllers).length >= 1);
  assert.equal(result.values.get(hash).length, 32);
  console.log("PASS certificate-verified public metadata");

  cli("deploy", "backend", "-y");
  const persisted = await actor.listCanisters();
  assert.equal(persisted.length, 2);
  assert.equal(
    persisted.find((entry) => entry.id.toText() === frontendId).history.length,
    1,
  );
  assert.equal((await outsider.listCanisters()).length, 0);
  projectList = await actor.listProjects();
  assert.equal(projectList.length, 1);
  assert.equal(projectList[0].name, "Renamed project");
  assert.equal(projectList[0].canisterIds.length, 2);
  assert.equal((await outsider.listProjects()).length, 0);
  console.log(
    "PASS projects, memberships, watchlists, snapshots, and caller isolation survive an actual canister upgrade",
  );

  ok(await actor.removeCanister(monitor));
  assert.equal((await actor.listProjects())[0].canisterIds.length, 1);
  ok(await actor.deleteProject(secondProject));
  assert.equal((await actor.listProjects()).length, 0);
  assert.equal((await actor.listCanisters())[0].history.length, 1);
  ok(await actor.removeCanister(target));
  assert.equal((await actor.listCanisters()).length, 0);
  error(await actor.removeCanister(target), /not found/);
  console.log("PASS removal changes only the user's watchlist");
  const quotaProjects = [];
  for (let i = 0; i < 20; i++)
    quotaProjects.push(ok(await actor.createProject(`Quota ${i}`)));
  error(await actor.createProject("Overflow"), /20 projects/);
  for (const id of quotaProjects) ok(await actor.deleteProject(id));
  console.log(
    "PASS project quota and deleting projects preserves canisters and history",
  );
} finally {
  cli(
    "canister",
    "settings",
    "update",
    "frontend",
    "--remove-status-viewer",
    backendId,
    "--remove-status-viewer",
    owner.getPrincipal().toText(),
    "-f",
  );
}
console.log("All local integration checks passed.");
