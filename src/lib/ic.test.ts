import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  actor: vi.fn(),
  agent: vi.fn(),
  env: vi.fn(),
}));

vi.mock("@icp-sdk/auth/client", () => ({
  AuthClient: class {
    constructor(options: unknown) {
      mocks.auth(options);
    }
  },
}));
vi.mock("@icp-sdk/core/agent", () => ({
  HttpAgent: { create: mocks.agent },
  StatePaths: {
    canisterControllers: vi.fn(),
    canisterModuleHash: vi.fn(),
    canisterCandid: vi.fn(),
    time: "time",
  },
}));
vi.mock("@icp-sdk/core/agent/canister-env", () => ({
  safeGetCanisterEnv: mocks.env,
}));
vi.mock("../bindings/backend", () => ({ createActor: mocks.actor }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("network routing", () => {
  for (const origin of [
    "http://frontend.local.localhost:8001",
    "https://orbit.example",
  ]) {
    it(`keeps mainnet II separate from application requests at ${origin}`, async () => {
      vi.stubGlobal("location", new URL(origin));
      const rootKey = new Uint8Array([1, 2, 3]);
      mocks.env.mockReturnValue({
        "PUBLIC_CANISTER_ID:backend": "aaaaa-aa",
        IC_ROOT_KEY: rootKey,
      });
      mocks.agent.mockResolvedValue({
        readState: vi.fn().mockResolvedValue({
          verifiedCertificate: { cert: {} },
          values: new Map(),
        }),
      });
      const { backend, publicMetadata } = await import("./ic");
      expect(mocks.auth).toHaveBeenCalledWith({
        agentOptions: { host: "https://icp-api.io" },
      });
      const { Ed25519KeyIdentity } = await import("@icp-sdk/core/identity");
      const identity = Ed25519KeyIdentity.generate();
      backend(identity);
      expect(mocks.actor).toHaveBeenCalledWith("aaaaa-aa", {
        agentOptions: { host: origin, rootKey, identity },
      });
      const { Principal } = await import("@icp-sdk/core/principal");
      await publicMetadata(Principal.fromText("aaaaa-aa"));
      expect(mocks.agent).toHaveBeenCalledWith({ host: origin, rootKey });
    });
  }
});
