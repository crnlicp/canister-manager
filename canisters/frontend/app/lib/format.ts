import { Principal } from "@icp-sdk/core/principal";
import type { Entry } from "../bindings/backend";

export const TRILLION = 1_000_000_000_000n;
export const DAY_NS = 86_400_000_000_000n;

export function cycles(value: bigint): string {
  if (value > 0n && value < TRILLION / 100n) return "<0.01 T";
  return `${(value / TRILLION).toLocaleString("en-US")}.${((value % TRILLION) / (TRILLION / 100n)).toString().padStart(2, "0")} T`;
}

export function bytes(value: bigint): string {
  if (value < 1024n) return `${value} B`;
  if (value < 1_048_576n) return `${(Number(value) / 1024).toFixed(1)} KiB`;
  if (value < 1_073_741_824n)
    return `${(Number(value) / 1_048_576).toFixed(1)} MiB`;
  return `${(Number(value) / 1_073_741_824).toFixed(2)} GiB`;
}

export function timeAgo(at: bigint, now = Date.now()): string {
  const seconds = Math.max(
    0,
    Math.floor((now - Number(at / 1_000_000n)) / 1000),
  );
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function validateCanisterId(input: string): Principal {
  const normalized = input.trim();
  const principal = Principal.fromText(normalized);
  if (
    principal.toText() !== normalized ||
    principal.isAnonymous() ||
    principal.toText() === "aaaaa-aa"
  ) {
    throw new Error("Enter a valid application canister ID.");
  }
  return principal;
}

export type Health =
  | "Healthy"
  | "Low cycles"
  | "Stopped"
  | "Stopping"
  | "Needs access"
  | "Unavailable"
  | "Not synced"
  | "Stale";

export function health(entry: Entry, now = Date.now()): Health {
  if (entry.lastError)
    return entry.lastError.startsWith("Access denied:")
      ? "Needs access"
      : "Unavailable";
  if (!entry.snapshot) return "Not synced";
  if (now - Number(entry.snapshot.at / 1_000_000n) > 300_000) return "Stale";
  const status = entry.snapshot.details;
  if (status.status === "stopped") return "Stopped";
  if (status.status === "stopping") return "Stopping";
  if (
    status.cycles < TRILLION ||
    status.cycles < status.idle_cycles_burned_per_day * 7n
  )
    return "Low cycles";
  return "Healthy";
}

export function hex(value: Uint8Array | undefined): string {
  return value
    ? Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("")
    : "No module installed";
}

export function json(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item: unknown) => {
      if (typeof item === "bigint") return item.toString();
      if (item instanceof Uint8Array) return hex(item);
      if (item instanceof Principal) return item.toText();
      return item;
    },
    2,
  );
}

export function download(name: string, value: unknown): void {
  const url = URL.createObjectURL(
    new Blob([json(value)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
