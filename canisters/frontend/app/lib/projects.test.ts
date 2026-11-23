import { describe, expect, it } from "vitest";
import { demoEntries, demoProjects } from "./demo";
import {
  projectFor,
  projectHistory,
  scopeEntries,
  summarize,
} from "./projects";

describe("single-project membership and scopes", () => {
  const entries = demoEntries();
  const projects = demoProjects();
  it("finds membership and leaves unmatched canisters ungrouped", () => {
    expect(projectFor(projects, entries[1].id.toText())?.name).toBe(
      "Finance stack",
    );
    expect(projectFor(projects, entries[4].id.toText())).toBeUndefined();
    expect(scopeEntries(entries, projects, "1")).toHaveLength(3);
    expect(scopeEntries(entries, projects, "ungrouped")).toEqual([entries[4]]);
    expect(scopeEntries(entries, projects, "all")).toBe(entries);
    expect(scopeEntries(entries, projects, "999")).toEqual([]);
  });
  it("partitions every canister exactly once without changing workspace totals", () => {
    const groups = [
      ...projects.map((project) =>
        scopeEntries(entries, projects, project.id.toString()),
      ),
      scopeEntries(entries, projects, "ungrouped"),
    ];
    expect(groups.flat()).toHaveLength(entries.length);
    expect(new Set(groups.flat().map((entry) => entry.id.toText())).size).toBe(
      entries.length,
    );
    for (const field of ["cycles", "memory", "burn"] as const) {
      expect(
        groups.reduce((sum, group) => sum + summarize(group)[field], 0n),
      ).toBe(summarize(entries)[field]);
    }
    expect(summarize(entries).cycles).toBe(96_950_000_000_000n);
    expect(summarize(scopeEntries(entries, projects, "1")).cycles).toBe(
      47_850_000_000_000n,
    );
  });
  it("reports missing snapshots as incomplete coverage, not fabricated balances", () => {
    const missing = { ...entries[0], snapshot: undefined };
    const totals = summarize([missing]);
    expect(totals.count).toBe(1);
    expect(totals.reported).toBe(0);
    expect(totals.attention).toBe(1);
    expect(totals.cycles).toBe(0n);
    expect(summarize([])).toEqual({
      count: 0,
      reported: 0,
      attention: 0,
      cycles: 0n,
      memory: 0n,
      burn: 0n,
    });
  });
  it("deleting a project returns members to Ungrouped without changing data", () => {
    const remaining = projects.filter((project) => project.id !== 1n);
    expect(scopeEntries(entries, remaining, "ungrouped")).toHaveLength(4);
    expect(summarize(entries).cycles).toBe(96_950_000_000_000n);
  });
});

describe("combined project cycle history", () => {
  const entries = demoEntries();
  it("sums synchronized samples exactly", () => {
    const history = projectHistory(entries);
    expect(history).toHaveLength(32);
    expect(history.at(-1)?.cycles).toBe(summarize(entries).cycles);
  });
  it("does not imply a partial history is a complete project", () => {
    expect(projectHistory([])).toEqual([]);
    expect(
      projectHistory([entries[0], { ...entries[1], history: [] }]),
    ).toEqual([]);
  });
  it("carries only prior observations and starts once all members have a sample", () => {
    const history = projectHistory([
      {
        ...entries[0],
        history: [
          { at: 1n, cycles: 10n },
          { at: 3n, cycles: 8n },
        ],
      },
      {
        ...entries[1],
        history: [
          { at: 2n, cycles: 20n },
          { at: 4n, cycles: 15n },
        ],
      },
    ]);
    expect(history).toEqual([
      { at: 2n, cycles: 30n },
      { at: 3n, cycles: 28n },
      { at: 4n, cycles: 23n },
    ]);
  });
});
