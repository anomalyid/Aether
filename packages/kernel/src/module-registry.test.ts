import { describe, expect, it } from "vitest";
import { ModuleRegistry, validateManifest } from "./module-registry";
import { makeManifest, makeModule } from "../../../tests/helpers/manifest";

describe("module registry", () => {
  it("menerima manifest yang valid", () => {
    expect(() => validateManifest(makeManifest("aether.valid"))).not.toThrow();
  });

  it("menolak ID modul tanpa namespace", () => {
    expect(() => validateManifest(makeManifest("Valid"))).toThrow(/ID modul/);
  });

  it("menolak permission yang tidak dikenal ketika daftar dibatasi", () => {
    const manifest = makeManifest("aether.izin", {
      permissions: { requested: ["rahasia.akses"] },
    });
    expect(() => validateManifest(manifest, { knownPermissions: ["demo.read"] })).toThrow(
      /tidak dikenal/,
    );
  });

  it("menolak contract required yang tidak disediakan", () => {
    const registry = new ModuleRegistry();
    registry.register(
      makeModule("aether.konsumen", {
        requires: { contracts: ["tidak.ada.v1"] },
      }),
    );
    expect(() => registry.validateAll()).toThrow(/tidak disediakan/);
  });

  it("menerima contract yang disediakan modul lain", () => {
    const registry = new ModuleRegistry();
    registry.register(makeModule("aether.penyedia", {
      provides: { contracts: ["demo.kontrak.v1"] },
    }));
    registry.register(makeModule("aether.konsumen", {
      requires: { contracts: ["demo.kontrak.v1"] },
    }));
    expect(() => registry.validateAll()).not.toThrow();
  });

  it("menolak dependency wajib yang tidak terdaftar", () => {
    const registry = new ModuleRegistry();
    registry.register(makeModule("aether.konsumen", {
      dependencies: { required: ["aether.hilang"], optional: [] },
    }));
    expect(() => registry.validateAll()).toThrow(/tidak terdaftar/);
  });

  it("mengabaikan dependency opsional yang tidak terdaftar", () => {
    const registry = new ModuleRegistry();
    registry.register(makeModule("aether.opsional", {
      dependencies: { required: [], optional: ["aether.hilang"] },
    }));
    expect(() => registry.validateAll()).not.toThrow();
  });

  it("mendeteksi modul duplikat", () => {
    const registry = new ModuleRegistry();
    registry.register(makeModule("aether.duplikat"));
    expect(() => registry.register(makeModule("aether.duplikat"))).toThrow(/sudah terdaftar/);
  });
});
