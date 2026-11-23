import type { Entry, Point, Project } from "../bindings/backend";
import { health } from "./format";

export function projectFor(
  projects: Project[],
  canisterId: string,
): Project | undefined {
  return projects.find((project) =>
    project.canisterIds.some((id) => id.toText() === canisterId),
  );
}

export function scopeEntries(
  entries: Entry[],
  projects: Project[],
  scope: string,
): Entry[] {
  if (scope === "all") return entries;
  return entries.filter((entry) => {
    const project = projectFor(projects, entry.id.toText());
    return scope === "ungrouped" ? !project : project?.id.toString() === scope;
  });
}

export function summarize(entries: Entry[], now = Date.now()) {
  const snapshots = entries.flatMap((entry) =>
    entry.snapshot ? [entry.snapshot] : [],
  );
  return {
    count: entries.length,
    reported: snapshots.length,
    cycles: snapshots.reduce(
      (sum, snapshot) => sum + snapshot.details.cycles,
      0n,
    ),
    memory: snapshots.reduce(
      (sum, snapshot) => sum + snapshot.details.memory_size,
      0n,
    ),
    burn: snapshots.reduce(
      (sum, snapshot) => sum + snapshot.details.idle_cycles_burned_per_day,
      0n,
    ),
    attention: entries.filter((entry) => health(entry, now) !== "Healthy")
      .length,
  };
}

export function projectHistory(entries: Entry[]): Point[] {
  if (!entries.length || entries.some((entry) => !entry.history.length))
    return [];
  const times = [
    ...new Set(
      entries.flatMap((entry) => entry.history.map((point) => point.at)),
    ),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return times.flatMap((at) => {
    let total = 0n;
    for (const entry of entries) {
      const sample = entry.history.filter((point) => point.at <= at).at(-1);
      if (!sample) return [];
      total += sample.cycles;
    }
    return [{ at, cycles: total }];
  });
}
