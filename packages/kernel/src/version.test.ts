import { describe, expect, it } from "vitest";
import { compareVersions, parseVersion, satisfiesSemver } from "./version";

describe("versi dan kompatibilitas semantic", () => {
  it("mem-parsing versi valid", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion("0.1.0-rc.1").prerelease).toBe("rc.1");
  });

  it("menolak versi tidak valid", () => {
    expect(() => parseVersion("latest")).toThrow();
    expect(() => parseVersion("1.2")).toThrow();
  });

  it("memahami caret untuk versi 0.x", () => {
    expect(satisfiesSemver("^0.1.0", "0.1.0")).toBe(true);
    expect(satisfiesSemver("^0.1.0", "0.1.9")).toBe(true);
    expect(satisfiesSemver("^0.1.0", "0.2.0")).toBe(false);
    expect(satisfiesSemver("^1.2.0", "1.9.0")).toBe(true);
    expect(satisfiesSemver("^1.2.0", "2.0.0")).toBe(false);
  });

  it("memahami tilde, eksak, comparator, dan rentang majemuk", () => {
    expect(satisfiesSemver("~1.2.3", "1.2.9")).toBe(true);
    expect(satisfiesSemver("~1.2.3", "1.3.0")).toBe(false);
    expect(satisfiesSemver("1.0.0", "1.0.0")).toBe(true);
    expect(satisfiesSemver(">=1.0.0 <2.0.0", "1.5.0")).toBe(true);
    expect(satisfiesSemver(">=1.0.0 <2.0.0", "2.0.0")).toBe(false);
    expect(satisfiesSemver("*", "9.9.9")).toBe(true);
  });

  it("membandingkan prerelease sebagai versi lebih rendah", () => {
    const stable = parseVersion("1.0.0");
    const rc = parseVersion("1.0.0-rc.1");
    expect(compareVersions(stable, rc)).toBeGreaterThan(0);
  });
});
