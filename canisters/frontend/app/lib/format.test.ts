import { describe, expect, it } from "vitest";
import { Principal } from "@icp-sdk/core/principal";
import { Variant_stopped_stopping_running } from "../bindings/backend";
import { demoEntries } from "./demo";
import {
  bytes,
  compact,
  cycles,
  runway,
  runwayDays,
  health,
  hex,
  json,
  timeAgo,
  TRILLION,
  validateCanisterId,
} from "./format";

describe("lossless cycle formatting", () => {
  it("formats zero and sub-centitrillion balances honestly", () => {
    expect(cycles(0n)).toBe("0.00 T");
    expect(cycles(1n)).toBe("<0.01 T");
    expect(cycles(TRILLION / 100n)).toBe("0.01 T");
  });
  it("does not round a balance up", () => {
    expect(cycles(42_869_999_999_999n)).toBe("42.86 T");
  });
  it("retains integer precision above JavaScript's safe integer", () => {
    expect(cycles(123456789012345678901234n)).toBe("123,456,789,012.34 T");
  });
  it("exports exact integer balances", () => {
    expect(JSON.parse(json({ cycles: 123456789012345678901234n })).cycles).toBe(
      "123456789012345678901234",
    );
  });
});

describe("canister principal validation", () => {
  it("accepts a canonical canister principal and whitespace", () => {
    expect(validateCanisterId("  rdmx6-jaaaa-aaaaa-aaadq-cai  ").toText()).toBe(
      "rdmx6-jaaaa-aaaaa-aaadq-cai",
    );
  });
  it.each([
    "",
    "not-a-canister",
    "rdmx7-jaaaa-aaaaa-aaadq-cai",
    "aaaaa-aa",
    "2vxsx-fae",
  ])("rejects invalid or special ID %s", (value) => {
    expect(() => validateCanisterId(value)).toThrow();
  });
});

describe("honest monitoring health", () => {
  it("does not label an unsynced or inaccessible canister healthy", () => {
    const entry = demoEntries()[0];
    expect(health({ ...entry, snapshot: undefined })).toBe("Not synced");
    expect(
      health({ ...entry, lastError: "Access denied: status access required" }),
    ).toBe("Needs access");
    expect(health({ ...entry, lastError: "Network timed out" })).toBe(
      "Unavailable",
    );
  });
  it("labels snapshots older than five minutes stale", () => {
    const entry = demoEntries()[0];
    expect(
      health(entry, Number(entry.snapshot!.at / 1_000_000n) + 300_001),
    ).toBe("Stale");
  });
  it("uses both the cycle floor and seven-day idle reserve", () => {
    const entry = demoEntries()[0];
    const snapshot = entry.snapshot!;
    expect(
      health({
        ...entry,
        snapshot: {
          ...snapshot,
          details: { ...snapshot.details, cycles: TRILLION - 1n },
        },
      }),
    ).toBe("Low cycles");
    expect(
      health({
        ...entry,
        snapshot: {
          ...snapshot,
          details: {
            ...snapshot.details,
            cycles: 2n * TRILLION,
            idle_cycles_burned_per_day: TRILLION,
          },
        },
      }),
    ).toBe("Low cycles");
    expect(health(entry)).toBe("Healthy");
  });
  it("preserves stopped and stopping states", () => {
    const entry = demoEntries()[0];
    const snapshot = entry.snapshot!;
    expect(
      health({
        ...entry,
        snapshot: {
          ...snapshot,
          details: {
            ...snapshot.details,
            status: Variant_stopped_stopping_running.stopped,
          },
        },
      }),
    ).toBe("Stopped");
    expect(
      health({
        ...entry,
        snapshot: {
          ...snapshot,
          details: {
            ...snapshot.details,
            status: Variant_stopped_stopping_running.stopping,
          },
        },
      }),
    ).toBe("Stopping");
  });
});

describe("display helpers and sample integrity", () => {
  it("formats binary memory units", () => {
    expect(bytes(512n)).toBe("512 B");
    expect(bytes(1024n)).toBe("1.0 KiB");
    expect(bytes(1_048_576n)).toBe("1.0 MiB");
    expect(bytes(1_073_741_824n)).toBe("1.00 GiB");
  });
  it("formats time without negative elapsed values", () => {
    expect(timeAgo(2_000_000_000n, 1000)).toBe("just now");
    expect(timeAgo(0n, 120_000)).toBe("2m ago");
    expect(timeAgo(0n, 7_200_000)).toBe("2h ago");
  });
  it("encodes hashes and principal JSON without losing values", () => {
    expect(hex(new Uint8Array([0, 15, 255]))).toBe("000fff");
    expect(json({ id: Principal.fromText("aaaaa-aa") })).toContain("aaaaa-aa");
  });
  it("uses valid IDs and ends demo history at the displayed balance", () => {
    for (const entry of demoEntries()) {
      expect(validateCanisterId(entry.id.toText()).toText()).toBe(
        entry.id.toText(),
      );
      expect(entry.history.length).toBe(32);
      expect(entry.history.at(-1)?.cycles).toBe(entry.snapshot?.details.cycles);
    }
  });
});

describe("idle runway", () => {
  const status = demoEntries()[0].snapshot!.details;
  it("divides balance by idle burn", () => {
    expect(
      runwayDays({ ...status, cycles: 10n, idle_cycles_burned_per_day: 3n }),
    ).toBe(3n);
    expect(
      runway({ ...status, cycles: 10n, idle_cycles_burned_per_day: 10n }),
    ).toBe("1 day");
  });
  it("never divides by zero or overstates long runways", () => {
    expect(runway({ ...status, idle_cycles_burned_per_day: 0n })).toBe(
      "No idle burn",
    );
    expect(
      runway({ ...status, cycles: 10_000n, idle_cycles_burned_per_day: 1n }),
    ).toBe("10+ years");
  });
  it("formats call counts compactly", () => {
    expect(compact(12_480n)).toBe("12.5K");
  });
});
