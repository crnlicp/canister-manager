import { AuthClient } from "@icp-sdk/auth/client";
import { HttpAgent, StatePaths, type Identity } from "@icp-sdk/core/agent";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import { Principal } from "@icp-sdk/core/principal";
import { createActor } from "../bindings/backend";
import { hex } from "./format";

export const environment = safeGetCanisterEnv<{
  "PUBLIC_CANISTER_ID:backend": string;
}>();
export const backendId = environment?.["PUBLIC_CANISTER_ID:backend"];
export const isLocal = ["localhost", "127.0.0.1"].some(
  (host) =>
    location.hostname === host || location.hostname.endsWith(`.${host}`),
);
export const networkName = isLocal ? "Local replica" : "ICP mainnet";
// II runs on mainnet even when the application backend runs locally.
export const auth = new AuthClient({
  agentOptions: { host: "https://icp-api.io" },
});

const appAgentOptions = {
  host: location.origin,
  rootKey: environment?.IC_ROOT_KEY,
};

export function backend(identity: Identity) {
  if (!backendId)
    throw new Error(
      "Backend not configured. Open the ICP-deployed frontend to connect your on-chain workspace.",
    );
  return createActor(backendId, {
    agentOptions: { ...appAgentOptions, identity },
  });
}

export async function publicMetadata(id: Principal) {
  const agent = await HttpAgent.create(appAgentOptions);
  const controllers = StatePaths.canisterControllers(id);
  const moduleHash = StatePaths.canisterModuleHash(id);
  const candid = StatePaths.canisterCandid(id);
  const result = await agent.readState(
    { canisterId: id },
    { paths: [controllers, moduleHash, candid, StatePaths.time] },
  );
  const certified = result.verifiedCertificate.cert;
  return {
    controllers:
      result.values.get(controllers)?.map((principal) => principal.toText()) ??
      [],
    moduleHash: result.values.get(moduleHash)
      ? hex(result.values.get(moduleHash) ?? undefined)
      : null,
    candid: result.values.get(candid),
    networkTime: result.values.get(StatePaths.time)?.toISOString(),
    subnet: certified.delegation
      ? Principal.fromUint8Array(certified.delegation.subnet_id).toText()
      : "Root subnet",
  };
}
