import { Principal } from "@icp-sdk/core/principal";
import {
  Variant_stopped_stopping_running,
  type Entry,
  type Project,
} from "../bindings/backend";
import { TRILLION } from "./format";

export function demoProjects(): Project[] {
  return [
    {
      id: 0n,
      name: "Identity",
      canisterIds: [Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai")],
    },
    {
      id: 1n,
      name: "Finance stack",
      canisterIds: [
        "um5iw-rqaaa-aaaaq-qaaba-cai",
        "ryjl3-tyaaa-aaaaa-aaaba-cai",
        "uf6dk-hyaaa-aaaaq-qaaaq-cai",
      ].map((id) => Principal.fromText(id)),
    },
  ];
}

export function demoEntries(): Entry[] {
  const now = BigInt(Date.now()) * 1_000_000n;
  const samples = [
    {
      name: "Internet Identity",
      id: "rdmx6-jaaaa-aaaaa-aaadq-cai",
      balance: 42_860n,
      burn: 120n,
      memory: 286,
      state: Variant_stopped_stopping_running.running,
    },
    {
      name: "Cycles ledger",
      id: "um5iw-rqaaa-aaaaq-qaaba-cai",
      balance: 28_450n,
      burn: 85n,
      memory: 154,
      state: Variant_stopped_stopping_running.running,
    },
    {
      name: "ICP ledger",
      id: "ryjl3-tyaaa-aaaaa-aaaba-cai",
      balance: 18_720n,
      burn: 64n,
      memory: 512,
      state: Variant_stopped_stopping_running.running,
    },
    {
      name: "Exchange rate",
      id: "uf6dk-hyaaa-aaaaq-qaaaq-cai",
      balance: 680n,
      burn: 130n,
      memory: 64,
      state: Variant_stopped_stopping_running.running,
    },
    {
      name: "Cycles minting",
      id: "rkp4c-7iaaa-aaaaa-aaaca-cai",
      balance: 6_240n,
      burn: 0n,
      memory: 98,
      state: Variant_stopped_stopping_running.stopped,
    },
  ];
  return samples.map((sample, index) => {
    const balance = (sample.balance * TRILLION) / 1000n;
    return {
      id: Principal.fromText(sample.id),
      name: sample.name,
      addedAt: now - 7n * 86_400_000_000_000n,
      lastAttempt: now,
      history: Array.from({ length: 32 }, (_, i) => ({
        at: now - BigInt(31 - i) * 2_700_000_000_000n,
        cycles:
          balance +
          BigInt(31 - i) * (sample.burn + 10n) * 1_000_000_000n +
          BigInt(Math.round(Math.sin(i * 0.8 + index) * 30 + 30)) *
            1_000_000_000n,
      })).map((point, i) => (i === 31 ? { ...point, cycles: balance } : point)),
      snapshot: {
        at: now,
        details: {
          cycles: balance,
          idle_cycles_burned_per_day: (sample.burn * TRILLION) / 1000n,
          reserved_cycles: TRILLION / 10n,
          memory_size: BigInt(sample.memory) * 1_048_576n,
          status: sample.state,
          module_hash: new Uint8Array(
            Array.from({ length: 32 }, (_, i) => (index * 33 + i * 7) % 256),
          ),
          settings: {
            controllers: [Principal.fromText(sample.id)],
            compute_allocation: 0n,
            memory_allocation: 0n,
            freezing_threshold: 2_592_000n,
            reserved_cycles_limit: 5n * TRILLION,
            wasm_memory_limit: 4_294_967_296n,
          },
          query_stats: {
            num_calls_total: BigInt(12480 + index * 456),
            num_instructions_total: 12_845_600n,
            request_payload_bytes_total: 1_250_000n,
            response_payload_bytes_total: 4_350_000n,
          },
        },
      },
    };
  });
}
