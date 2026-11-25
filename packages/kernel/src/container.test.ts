import { describe, expect, it, vi } from "vitest";
import type { ServiceToken } from "@aether/contracts";
import { AetherContainer } from "./container";

const TOKEN_COUNTER = { id: "counter", version: 1 } as ServiceToken<{ value: number }>;
const TOKEN_DEP = { id: "dep", version: 1 } as ServiceToken<{ label: string }>;
const TOKEN_SCOPED = { id: "scoped", version: 1 } as ServiceToken<{ label: string }>;
const TOKEN_HOLDER = { id: "holder", version: 1 } as ServiceToken<{ label: string }>;

describe("DI container", () => {
  it("singleton mengembalikan instance yang sama", async () => {
    const container = new AetherContainer();
    container.register({
      token: TOKEN_COUNTER,
      lifetime: "singleton",
      factory: () => ({ value: Math.random() }),
    });

    const first = await container.resolve(TOKEN_COUNTER);
    const second = await container.resolve(TOKEN_COUNTER);
    expect(first).toBe(second);
  });

  it("transient membuat instance baru setiap resolusi", async () => {
    const container = new AetherContainer();
    container.register({
      token: TOKEN_COUNTER,
      lifetime: "transient",
      factory: () => ({ value: Math.random() }),
    });

    expect(await container.resolve(TOKEN_COUNTER)).not.toBe(await container.resolve(TOKEN_COUNTER));
  });

  it("scoped sama di dalam scope dan berbeda antar scope", async () => {
    const container = new AetherContainer();
    container.register({
      token: TOKEN_SCOPED,
      lifetime: "scoped",
      factory: () => ({ label: Math.random().toString() }),
    });

    const scopeA = container.createScope({ id: "a", values: {} });
    const scopeB = container.createScope({ id: "b", values: {} });

    expect(await scopeA.resolve(TOKEN_SCOPED)).toBe(await scopeA.resolve(TOKEN_SCOPED));
    expect(await scopeA.resolve(TOKEN_SCOPED)).not.toBe(await scopeB.resolve(TOKEN_SCOPED));
  });

  it("mendeteksi registrasi ganda", () => {
    const container = new AetherContainer();
    const register = () => container.register({
      token: TOKEN_COUNTER,
      lifetime: "singleton",
      factory: () => ({ value: 1 }),
    });

    register();
    expect(register).toThrow(/sudah terdaftar/);
  });

  it("mendeteksi service tidak ditemukan", async () => {
    const container = new AetherContainer();
    await expect(container.resolve(TOKEN_COUNTER)).rejects.toThrow(/tidak terdaftar/);
  });

  it("mendeteksi siklus dependency", async () => {
    const container = new AetherContainer();
    const tokenA = { id: "cycleA", version: 1 } as ServiceToken<{ label: string }>;
    const tokenB = { id: "cycleB", version: 1 } as ServiceToken<{ label: string }>;

    container.register({
      token: tokenA,
      lifetime: "singleton",
      factory: async (ctx) => ({ label: (await ctx.resolve(tokenB)).label }),
    });
    container.register({
      token: tokenB,
      lifetime: "singleton",
      factory: async (ctx) => ({ label: (await ctx.resolve(tokenA)).label }),
    });

    await expect(container.resolve(tokenA)).rejects.toThrow(/Siklus dependency/);
  });

  it("menolak singleton yang menangkap dependency scoped", async () => {
    const container = new AetherContainer();
    container.register({
      token: TOKEN_SCOPED,
      lifetime: "scoped",
      factory: () => ({ label: "scoped" }),
    });
    container.register({
      token: TOKEN_HOLDER,
      lifetime: "singleton",
      factory: async (ctx) => ({ label: (await ctx.resolve(TOKEN_SCOPED)).label }),
    });

    await expect(container.resolve(TOKEN_HOLDER)).rejects.toThrow(/tidak boleh di-resolve/);
  });

  it("membutuhkan scope untuk service scoped", async () => {
    const container = new AetherContainer();
    container.register({
      token: TOKEN_SCOPED,
      lifetime: "scoped",
      factory: () => ({ label: "scoped" }),
    });
    await expect(container.resolve(TOKEN_SCOPED)).rejects.toThrow(/createScope/);
  });

  it("scope membersihkan instance dengan urutan terbalik", async () => {
    const order: string[] = [];
    const container = new AetherContainer();
    container.register({
      token: TOKEN_DEP,
      lifetime: "scoped",
      factory: () => ({
        label: "dep",
        dispose: async () => { order.push("dep"); },
      }) as unknown as { label: string },
    });
    container.register({
      token: TOKEN_HOLDER,
      lifetime: "scoped",
      factory: () => ({
        label: "holder",
        dispose: async () => { order.push("holder"); },
      }) as unknown as { label: string },
    });

    const scope = container.createScope({ id: "a", values: {} });
    await scope.resolve(TOKEN_DEP);
    await scope.resolve(TOKEN_HOLDER);
    await scope.dispose();

    expect(order).toEqual(["holder", "dep"]);
    await expect(scope.resolve(TOKEN_DEP)).rejects.toThrow(/sudah dibersihkan/);
  });

  it("container membersihkan singleton saat dispose", async () => {
    const dispose = vi.fn(async () => {});
    const container = new AetherContainer();
    container.register({
      token: TOKEN_COUNTER,
      lifetime: "singleton",
      factory: () => ({ value: 1, dispose }) as unknown as { value: number },
    });

    await container.resolve(TOKEN_COUNTER);
    await container.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    await container.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
