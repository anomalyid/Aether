import { describe, expect, it, vi } from "vitest";
import type { Disposable } from "@aether/contracts";
import { AetherResourceRegistry } from "./resource-registry";

describe("resource registry", () => {
  it("membersihkan resource dalam urutan terbalik", async () => {
    const order: string[] = [];
    const registry = new AetherResourceRegistry();
    const make = (name: string): Disposable => ({
      dispose: async () => { order.push(name); },
    });

    registry.register(make("pertama"), "modul.a");
    registry.register(make("kedua"), "modul.b");
    await registry.disposeAll();

    expect(order).toEqual(["kedua", "pertama"]);
    expect(registry.list()).toHaveLength(0);
  });

  it("tetap membersihkan resource lain meski ada kegagalan", async () => {
    const dispose = vi.fn(async () => {});
    const registry = new AetherResourceRegistry();
    registry.register({ dispose: async () => { throw new Error("gagal"); } }, "rusak");
    registry.register({ dispose }, "sehat");

    await expect(registry.disposeAll()).rejects.toThrow(/gagal dibersihkan/);
    expect(dispose).toHaveBeenCalledOnce();
    expect(registry.list()).toHaveLength(0);
  });

  it("menolak resource tanpa Dispose", () => {
    const registry = new AetherResourceRegistry();
    expect(() => registry.register({} as Disposable)).toThrow();
  });
});
