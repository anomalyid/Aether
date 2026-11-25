# Dokumen 07 — Data, API & Developer Platform Specification

## 7.1 Data architecture

PostgreSQL = primary transactional database. Redis = cache/queue/lock/sementara. Object storage = file & artifact besar. Vector search hanya bila retrieval semantik benar-benar dibutuhkan. **MUST NOT** menyimpan semua data di vector database.

## 7.2 Storage responsibilities

| Storage | Tanggung jawab |
| --- | --- |
| PostgreSQL | Transactional records |
| Redis | Cache & queue |
| Object storage | File & artifacts |
| Vector index | Semantic retrieval |
| Secret vault | Credential & key references |
| Search index | Full-text bila dibutuhkan |

## 7.3 Initial database domains

```
identity/     users, tenants, memberships, principals, roles, permissions
agents/       agents, agent_versions, agent_runs, agent_run_steps
capabilities/ capabilities, capability_versions, capability_providers, capability_invocations
extensions/   skills, skill_versions, skill_installations, plugins, plugin_versions
integrations/ integrations, provider_accounts, connections, external_events
protocols/    mcp_servers, mcp_connections, mcp_tool_snapshots
workflows/    workflow_definitions, workflow_versions, workflow_runs, workflow_steps
knowledge/    documents, document_chunks, memories, retrieval_records
governance/   approvals, policies, audit_logs
platform/     events, outbox_events, idempotency_records, usage_records
```

## 7.4 Data invariants

- Semua resource tenant memiliki tenant ownership.
- Foreign key mempertahankan integritas.
- Unique constraint untuk identifier penting.
- Timestamp dalam UTC.
- Semua migration diberi versi.
- Soft deletion hanya jika ada kebutuhan audit/recovery.
- Retention memiliki batas.
- Penghapusan data mencakup index & cache terkait.
- Data sensitif dienkripsi sesuai klasifikasi.

## 7.5 Tenant isolation

Lapisan perlindungan: (1) tenant context tervalidasi; (2) repository query tenant-aware; (3) authorization di service layer; (4) database constraints; (5) PostgreSQL Row-Level Security jika sesuai; (6) automated cross-tenant tests.

RLS **MUST NOT** menggantikan authorization aplikasi. Database role dengan hak istimewa yang melewati RLS **MUST NOT** dipakai untuk request biasa tanpa kontrol disengaja.

## 7.6 API architecture

Prefix `/v1/`. Endpoint awal: `/v1/tenants`, `/v1/members`, `/v1/agents`, `/v1/agents/{id}/runs`, `/v1/skills`, `/v1/plugins`, `/v1/capabilities`, `/v1/integrations`, `/v1/mcp/servers`, `/v1/workflows`, `/v1/executions`, `/v1/approvals`, `/v1/audit-logs`, `/v1/usage`. Ini rancangan kontrak, **bukan API aktif**.

## 7.7 API conventions

Wajib: authentication, authorization, tenant context, request ID, pagination, filtering, sorting bila perlu, validation, consistent error format, rate limits, idempotency untuk operasi sesuai, OpenAPI documentation.

```json
{
  "data": {},
  "meta": { "request_id": "req_example" },
  "error": null
}
```

```json
{
  "data": null,
  "meta": { "request_id": "req_example" },
  "error": {
    "code": "AUTHORIZATION_DENIED",
    "message": "The operation is not authorized",
    "details": {}
  }
}
```

## 7.8 Error taxonomy

`VALIDATION_ERROR`, `AUTHENTICATION_REQUIRED`, `AUTHORIZATION_DENIED`, `TENANT_CONTEXT_REQUIRED`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `RATE_LIMITED`, `APPROVAL_REQUIRED`, `POLICY_BLOCKED`, `DEPENDENCY_UNAVAILABLE`, `PROVIDER_UNAVAILABLE`, `EXECUTION_TIMEOUT`, `EXECUTION_CANCELLED`, `IDEMPOTENCY_CONFLICT`, `INTERNAL_ERROR`.

Error response **MUST NOT** membocorkan informasi internal atau data tenant lain.

## 7.9 Pagination

Cursor pagination untuk collection yang terus bertambah.

```json
{ "data": [], "meta": { "next_cursor": "cursor_example", "has_more": true } }
```

Cursor tervalidasi dan **MUST NOT** menjadi cara melewati authorization.

## 7.10 API versioning

Public API major version; internal contracts versi sendiri; event schema versi; plugin & skill versi; agent definition immutable version; breaking change butuh migration path; deprecated API punya jadwal penghentian jelas.

## 7.11 SDK

Prioritas: TypeScript SDK → Python SDK setelah core API stabil → CLI → REST API sebagai interface universal.

```ts
const aether = new AetherClient({ apiKey: process.env.AETHER_API_KEY });
const agent = await aether.agents.get("agent-id");
const run = await aether.agents.run(agent.id, { input: { message: "Summarize this request" } });
```

Ini contoh target DX, **bukan implementasi yang sudah tersedia**. SDK wajib: type-safe request, auth handling, error mapping, pagination, retry policy, streaming, timeout, cancellation, request tracing, compatibility check.

## 7.12 CLI

Nama sementara: `aether`.

```
aether init | doctor | dev | modules list | agents create | agents list
aether skills validate ./my-skill | skills install ./my-skill
aether capabilities list | integrations list | workflows list
aether executions inspect <id> | logs | test | deploy
```

CLI wajib membedakan operasi lokal, remote, dan operasi yang butuh permission khusus.

## 7.13 Developer experience

Documentation portal, API reference, SDK reference, CLI reference, module development guide, skill authoring guide, plugin development guide, MCP integration guide, agent development guide, testing toolkit, example projects, migration guide, troubleshooting guide.

## 7.14 Testing framework

| Jenis | Tujuan |
| --- | --- |
| Unit | Fungsi individual |
| Integration | Interaksi antar-modul |
| Contract | Kesesuaian interface |
| E2E | Alur lengkap |
| Security | Akses & isolasi |
| Load | Perilaku saat beban |
| Fault injection | Kegagalan dependency |
| Evaluation | Kualitas agent |
| Migration | Perubahan data |
| Compatibility | Versi extension |

## 7.15 AI coding-agent documentation

Setiap repository wajib memiliki `AGENTS.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `SECURITY.md`, dan `docs/`.

Instruksi wajib: baca architecture docs sebelum ubah kode; jangan ubah kontrak publik tanpa ADR; jangan buat migration destruktif tanpa review; jangan nonaktifkan security test; jangan tambah dependency tanpa alasan; jangan ubah file di luar scope; jalankan test relevan; laporkan keterbatasan test; jangan klaim selesai jika belum diuji.

## 7.16 Acceptance criteria

- [ ] Schema database memiliki ownership jelas
- [ ] Tenant isolation diuji
- [ ] Migration dapat dijalankan & di-rollback sesuai strategi
- [ ] API memiliki OpenAPI specification
- [ ] API error format konsisten
- [ ] Cursor pagination berfungsi
- [ ] SDK memiliki contract test
- [ ] CLI memiliki command validation
- [ ] Dokumentasi dapat diuji terhadap implementasi
- [ ] AI coding-agent instructions tersedia
