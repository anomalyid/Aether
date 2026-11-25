# ARCHITECTURE.md — Ringkasan Arsitektur Aether

Versi: 0.1.0-draft · Dokumen lengkap: [`docs/specifications/`](docs/specifications/)

## Filosofi

Aether bukan satu agent yang melakukan segalanya. Aether adalah infrastruktur yang memungkinkan banyak agent, tools, Skills, workflow, provider, dan aplikasi bekerja bersama **dalam batas yang terkontrol**.

## Batas sistem

**Aether bertanggung jawab atas:** lifecycle agent, capability registration, authorization internal, orchestrasi execution, governance ekstensi, lifecycle integrasi, state workflow, audit record, konfigurasi platform.

**Aether tidak bertanggung jawab atas:** ketersediaan provider AI eksternal, kebenaran data pihak ketiga, jaringan internet, keputusan bisnis pengguna, legal compliance provider eksternal. Namun Aether wajib mendeteksi, membatasi, mencatat, dan menangani kegagalan dari faktor tersebut.

## Domain (bounded context)

| # | Domain | Tanggung jawab |
| --- | --- | --- |
| 01 | Kernel | Module lifecycle, configuration, contracts |
| 02 | Identity | Users, tenants, principals, memberships |
| 03 | Security | Authorization, policies, approvals, audit |
| 04 | Capability | Registry, resolver, invocation |
| 05 | Agent | Runtime, orchestration, versions |
| 06 | Extension | Skills, plugins, packages |
| 07 | Protocol | MCP, A2A, internal API |
| 08 | Integration | Provider adapters & connections |
| 09 | Workflow | Tasks, jobs, durable state |
| 10 | Knowledge | Memory, documents, retrieval |
| 11 | Data | Persistence, storage, indexing |
| 12 | Operations | Observability, recovery, health |
| 13 | Developer | SDK, CLI, testing, docs |

Domain tidak boleh menulis langsung ke tabel/internal domain lain. Gunakan interface atau event.

## Keputusan arsitektur yang sudah dikunci

- ADR-001 Modular monolith sebagai awal.
- ADR-002 PostgreSQL sebagai primary database.
- ADR-003 Internal capability contract sebagai kontrak kanonis.
- ADR-004 Model Gateway untuk seluruh akses AI.
- ADR-005 Ekstensi eksternal untrusted by default.
- ADR-006 Control plane dan execution plane terpisah secara tanggung jawab.
- ADR-007 Event-driven integration + outbox.
- ADR-008 Runtime adapter, framework eksternal bukan source of truth.
- ADR-009 TypeScript first.
- ADR-010 No premature microservices.

## Dependency graph (konseptual)

```
Core Kernel → Infrastructure → Identity → Security → Capability
→ Event & Workflow → Agent Runtime → Extension → Protocol & Integration
→ Developer Platform & Products
```

## Pipeline capability (kanonik)

```
Authenticate → Resolve Capability → Validate Input → Check Tenant
→ Authorize → Risk Evaluation → Approval (if required) → Execute Provider
→ Validate Output → Audit → Return Result
```

## Component internal Kernel (sudah diimplementasi)

- `dependency-graph` — topological sort + deteksi siklus.
- `container` — DI dengan lifetime singleton/scoped/transient + scope disposal.
- `module-registry` — validasi manifest, prioritas startup, resolusi dependency.
- `lifecycle` — state machine modul yang ketat.
- `resource-registry` — ownership dan cleanup urutan terbalik.
- `health` — liveness, readiness, dependency health tanpa membocorkan secret.
- `bootstrap` — startup deterministik, rollback saat gagal, graceful shutdown.

## Konvensi Bahasa

Nama teknis kode dalam English. Seluruh dokumentasi, komentar panjang, dan komunikasi dalam **Bahasa Indonesia**.
