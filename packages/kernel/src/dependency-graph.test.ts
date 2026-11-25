import { describe, expect, it } from "vitest";
import { topologicalSort } from "./dependency-graph";

describe("dependency graph", () => {
  it("mengurutkan berdasarkan prioritas ketika tidak ada dependency", () => {
    const result = topologicalSort([
      { id: "c", value: "c", dependencies: [], priority: 300 },
      { id: "a", value: "a", dependencies: [], priority: 100 },
      { id: "b", value: "b", dependencies: [], priority: 200 },
    ]);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("mendahulukan dependency meski prioritas lebih tinggi", () => {
    const result = topologicalSort([
      { id: "app", value: "app", dependencies: ["db"], priority: 1 },
      { id: "db", value: "db", dependencies: [], priority: 999 },
    ]);
    expect(result).toEqual(["db", "app"]);
  });

  it("menolak dependency yang tidak terdaftar", () => {
    expect(() =>
      topologicalSort([{ id: "app", value: "app", dependencies: ["ghost"] }]),
    ).toThrow(/tidak terdaftar/);
  });

  it("mendeteksi siklus", () => {
    expect(() =>
      topologicalSort([
        { id: "a", value: "a", dependencies: ["b"] },
        { id: "b", value: "b", dependencies: ["a"] },
      ]),
    ).toThrow(/siklus/i);
  });

  it("menolak duplikat dan self dependency", () => {
    expect(() =>
      topologicalSort([
        { id: "a", value: 1, dependencies: [] },
        { id: "a", value: 2, dependencies: [] },
      ]),
    ).toThrow(/lebih dari satu kali/);

    expect(() =>
      topologicalSort([{ id: "a", value: 1, dependencies: ["a"] }]),
    ).toThrow(/dirinya sendiri/);
  });

  it("menyaring dependency duplikat", () => {
    const result = topologicalSort([
      { id: "db", value: "db", dependencies: [] },
      { id: "app", value: "app", dependencies: ["db", "db"] },
    ]);
    expect(result).toEqual(["db", "app"]);
  });
});
