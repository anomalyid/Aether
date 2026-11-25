# Status Implementasi Aether — Bukti dan Batas

Dokumen ini memisahkan **yang sudah dibangun dan diuji** dari **yang masih rancangan**. Tujuannya mencegah klaim berlebihan.

Verifikasi terakhir: `pnpm build` lulus · **153 test lulus dalam 21 file** · satu test MVP end-to-end.

## 1. Yang sudah diimplementasi dan diuji

| Fase | Komponen | Lokasi | Bukti |
| --- | --- | --- | --- |
| 0 | Konfigurasi workspace, TypeScript strict, Vitest, CI | `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml` | Build & CI |
| 1 | Core Kernel: dependency graph, DI, lifecycle, registry, resource, health, bootstrap | `packages/kernel` | 9 file test |
| 1 | Contracts, errors + redaksi secret, identifiers, configuration, context | `packages/*` | 5 file test |
| 2 | Identity: tenant, user, role, membership, principal + guard tenant | `domains/identity` | `services.test.ts` |
| 2 | Migrasi SQL 0001 dengan Row-Level Security + adapter memory | `adapters/database` | Test domain |
| 3 | Security: policy engine RBAC+ABAC, delegasi, approval, audit | `domains/security` | `security.test.ts` |
| 3 | Migrasi SQL 0002 (audit append-only) | `adapters/database` | — |
| 4 | Capability: registry, schema validator, execution pipeline | `domains/capabilities` | `capability.test.ts` |
| 4 | Idempotency, migrasi SQL 0003 | `adapters/database` | Test engine |
| 5 | Agent: Model Gateway, Context Engine, Runtime, Evaluation | `domains/agents` | `agent.test.ts` |
| 5 | Migrasi SQL 0004 | `adapters/database` | — |
| 6 | Events: envelope, bus, outbox, consumer idempotent | `packages/events` | `index.test.ts` |
| 6 | Workflow: checkpoint, retry, approval, recovery | `domains/workflows` | `workflow.test.ts` |
| 6 | Skills: parser `SKILL.md`, validasi, progressive disclosure | `domains/skills` | `skills.test.ts` |
| 6 | WhatsApp: HMAC webhook, challenge, normalisasi, Baileys guard | `adapters/providers/whatsapp` | `index.test.ts` |
| 6 | MCP 2026-07-28: meta, `server/discover`, tool snapshot, token guard | `protocols/mcp` | `index.test.ts` |
| 6 | A2A v1.0: Agent Card, delegasi task, scope/deadline/budget | `protocols/a2a` | `index.test.ts` |
| MVP | Skenario lengkap event → agent → skill → capability → approval → audit | `tests/e2e/mvp.test.ts` | 1 test gate |

## 2. MVP Gate — bukti fondasi bekerja

`tests/e2e/mvp.test.ts` menyatukan komponen nyata (bukan mock untuk domain inti) dan membuktikan:

1. Tenant, user, role, permission, dan principal dibuat.
2. Webhook WhatsApp diverifikasi dan dinormalisasi ke `UnifiedMessage`.
3. Event masuk lewat outbox dan diterima consumer.
4. Skill `SKILL.md` dibaca lewat progressive disclosure.
5. Agent runtime menjalankan tool call ke `messaging.send`.
6. Capability berisiko tinggi **ditolak** sampai approval diberikan.
7. Approval terikat parameter yang sama persis.
8. Capability dieksekusi, output divalidasi.
9. Audit tercatat, event `capability.invoked` dan `agent.run.completed` tersedia.
10. Isolasi tenant teruji (audit tenant lain kosong).
11. Correlation ID `corr_mvp` terbawa sampai ke agent run.

## 3. Keputusan implementasi yang tercatat

- **Shutdown dua fase** — stop semua modul dulu, baru dispose semua (Dokumen 02 §2.12). Ditemukan lewat test yang gagal, diperbaiki di implementasi.
- **`requestPermissions()` hanya mencatat** — pemberian izin nyata ada di domain Security.
- **Config disaring** sebelum diberikan ke modul; akses secret via vault (belum dibangun).
- **Audit append-only** — port repository sengaja tidak punya update/delete.
- **Untrusted by default** — deskripsi tool MCP, hasil tool, dan konten eksternal diberi label untrusted dan tidak pernah dirender sebagai instruksi sistem.
- **FAILED dapat di-resume** pada workflow sebagai recovery setelah restart.
- **Permission provider memetakan principal → subject** sebelum lookup membership; principal ID bukan user ID.

## 4. Yang belum diimplementasi (dilarang diklaim selesai)

- API HTTP/OpenAPI dan endpoint `/v1/*`.
- Migrasi dijalankan pada PostgreSQL sungguhan beserta uji RLS lintas tenant.
- Adapter produksi untuk database, Redis, queue, object storage, dan secret vault.
- SDK TypeScript/Python dan CLI `aether`.
- Aether Console / Studio.
- MCP Server sisi Aether (baru MCP Client yang diuji) dan A2A transport sungguhan.
- Provider WhatsApp Cloud API sungguhan (baru webhook verification + normalisasi).
- Security audit formal, load test, RPO/RTO, disaster recovery test.
- Clearancy merek PDKI/WIPO dan domain.

## 5. Perintah verifikasi

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

## 6. Langkah berikutnya

Sesuai urutan yang tidak boleh dibalik dan setelah fondasi terbukti:

1. API HTTP/OpenAPI + migrasi PostgreSQL nyata + uji RLS lintas tenant.
2. MCP Server, A2A transport, dan provider Cloud API sungguhan.
3. SDK + CLI.
4. Console/Studio.
5. Production readiness (audit, benchmark, recovery).

**By Anomalyid.**
