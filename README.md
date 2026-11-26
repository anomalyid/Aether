# AETHER

**The Fabric of Intelligence.**
*Connected systems. Unified capabilities. Intelligent execution.*

**Aether** adalah platform infrastruktur modular untuk membangun, menghubungkan, menjalankan, mengelola, dan mengembangkan sistem berbasis AI Agent serta kemampuan digital lainnya.

Satu fondasi. Banyak produk. Kemampuan terus berkembang tanpa membongkar fondasi.

---

## Status proyek

| Item | Status |
| --- | --- |
| Master Technical Specification | Draft baseline selesai (8 dokumen + lampiran) |
| Identitas & arsitektur | Defined |
| Repository | Aktif di GitHub, cabang `main` |
| Core Kernel | Terimplementasi + teruji |
| Identity, Security, Capability, Agent, Skills, Workflow, Events | Terimplementasi + teruji |
| Protocol MCP & A2A | Adapter kontrak terimplementasi + teruji |
| Integrasi WhatsApp | Webhook, verifikasi, dan normalisasi teruji |
| MVP gate end-to-end | **Terbukti** — `tests/e2e/mvp.test.ts` |
| API HTTP `/v1` + OpenAPI | Terimplementasi + teruji |
| SDK TypeScript + CLI `aether` | Terimplementasi + teruji |
| PostgreSQL migration runner + RLS | Teruji dengan database sungguhan |
| Repository PostgreSQL Identity & Security | Terimplementasi + teruji |
| SDK Python | Terimplementasi + teruji |
| Test | **176 unit + 6 integrasi + 4 Python lulus** |
| Produksi | Belum — lihat batas di bawah |

> Fondasi engineering sudah terbukti lewat test end-to-end. Ini **bukan** berarti seluruh software produksi selesai: API HTTP, migrasi real di PostgreSQL, SDK/CLI, security audit, benchmark, dan clearancy merek masih tertunda.

---

## Nama kerja

- **Master brand (working name):** AETHER
- **Platform inti (working candidate):** Aether Weave
- **Fondasi teknis:** Aether Core
- **Signature:** By Anomalyid
- **Status merek:** **belum dikonfirmasi** — wajib dicek ke PDKI dan WIPO sebelum pengumuman publik.

Nama seperti Aether Pay, Aether OS, Aether Data, dan sejenisnya adalah **kandidat arsitektur produk**, bukan komitmen dan bukan alasan untuk dibangun sekarang.

---

## Prinsip inti

1. **Modular by design** — setiap domain punya batas jelas.
2. **Contract first** — interface ditentukan sebelum implementasi.
3. **Secure by default** — izin default adalah *deny*.
4. **Tenant isolation** — tidak ada akses lintas tenant tanpa izin eksplisit.
5. **Provider & model agnostic** — semua provider berada di balik adapter.
6. **Observable execution** — setiap execution punya trace dan correlation ID.
7. **Durable state** — state penting dapat dipulihkan.
8. **Extensible core** — ekstensi masuk tanpa mengubah core.
9. **Testable architecture** — setiap domain bisa diuji terpisah.
10. **Sustainable engineering** — kompleksitas hanya dibuat saat dibutuhkan.

---

## Arah arsitektur

```
Control Plane                    Execution Plane
─────────────                    ────────────────
Identity                        Agent Runtime
Policies                        Capability Executor
Registries                      Workflow Workers
Configuration                   Event Consumers
Governance                      Integration Workers
```

Aether dimulai sebagai **modular monolith** (ADR-001), bukan microservices. Pemisahan proses dilakukan hanya jika ada alasan yang bisa dibuktikan: skala, isolasi keamanan, atau deployment independence.

Pipeline eksekusi kanonik:

```
Event → Normalisasi → Agent → Skill → Capability → Authorization
      → Policy → Approval (jika perlu) → Execution → Validasi
      → Audit + Trace → Hasil
```

Tidak ada jalur pintas yang memungkinkan agent melewati pemeriksaan izin.

---

## Struktur repository

```
packages/     primitive inti (kernel, contracts, errors, config, context)
domains/      bounded context (identity, security, capabilities, agents, ...)
adapters/     implementasi teknis (database, models, mcp, whatsapp, ...)
developer/    SDK, CLI, testing toolkit
apps/         API, console, workers, control-plane
docs/         Master Technical Specification, ADR, threat model, panduan
examples/     contoh agent, skill, plugin, integrasi
tests/        unit, integration, contract, e2e, security, evaluation
```

Folder dibuat **saat modulnya mulai dibangun**, bukan sekadar dibuat kosong sejak hari pertama.

Saat ini yang sudah berisi kode nyata dan teruji: `packages/`, `domains/`, `adapters/`, `protocols/`, `apps/api`, `developer/`, dan `tests/`.

---

## Mulai cepat

```bash
pnpm install
pnpm build     # kompilasi TypeScript seluruh workspace
pnpm test      # 176 test unit
```

Menjalankan API dengan data contoh:

```bash
AETHER_SEED_DEMO=true PORT=3000 node apps/api/dist/bin.js
curl http://localhost:3000/openapi.json
```

Atau pakai Docker Compose:

```bash
docker compose -f infrastructure/compose/docker-compose.yml up --build
```

Uji integrasi PostgreSQL (RLS lintas tenant):

```bash
AETHER_TEST_DATABASE_URL=postgres://aether:aether@localhost:55432/aether pnpm test:integration
```

Butuh Node.js **≥ 22.12** dan pnpm **12.21**.

Contoh penggunaan kernel:

```ts
import { AetherApplication, defineModule } from "@aether/kernel";

const healthModule = defineModule({
  manifest: {
    id: "aether.health-demo",
    name: "Health Demo",
    version: "1.0.0",
    description: "Modul contoh untuk demonstrasi lifecycle",
    runtime: { package: "@aether/demo", entrypoint: "dist/index.js" },
    compatibility: { kernel: "^0.1.0", contracts: "^0.1.0" },
    dependencies: { required: [], optional: [] },
    provides: { contracts: ["demo.health.v1"] },
    requires: { contracts: [] },
    permissions: { requested: [] },
    lifecycle: { startupPriority: 100, shutdownTimeoutMs: 5000 },
    health: { enabled: true },
  },
  async initialize() {},
  async start() {},
  async healthCheck() {
    return { status: "healthy", checkedAt: new Date().toISOString() };
  },
  async stop() {},
  async dispose() {},
});

const app = await AetherApplication.create({
  modules: [healthModule],
});

await app.start();
console.log(await app.getHealthReport());
await app.shutdown();
```

---

## Dokumentasi utama

- [`docs/specifications/`](docs/specifications/) — 8 dokumen Master Technical Specification.
- [`docs/adr/`](docs/adr/) — Architecture Decision Records.
- [`docs/security/threat-model.md`](docs/security/threat-model.md) — model ancaman.
- [`docs/research/`](docs/research/) — hasil riset MCP, A2A, Agent Skills, WhatsApp, OWASP.
- [`AGENTS.md`](AGENTS.md) — aturan wajib untuk AI coding agent.
- [`docs/development/implementation-status.md`](docs/development/implementation-status.md) — bukti implementasi dan batasnya.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — ringkasan arsitektur.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — tata cara kontribusi.
- [`SECURITY.md`](SECURITY.md) — pelaporan kerentanan.

---

## Urutan pembangunan (tidak boleh dibalik)

1. Core
2. Identity & data foundation
3. Security & trust
4. Capability infrastructure
5. Agent runtime
6. Skills & plugins
7. Protocol & integrations
8. Workflow
9. Developer platform
10. Production & cloud
11. Ekosistem produk masa depan

Jangan mulai dengan marketplace, Aether OS, atau Aether Pay sebelum fondasi terbukti.

---

## Lisensi

MIT — lihat [`LICENSE`](LICENSE). Implementasi produksi, audit keamanan, dan clearancy merek tetap menjadi tanggung jawab terpisah.

**By Anomalyid.**
