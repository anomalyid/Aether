# AETHER — MASTER TECHNICAL SPECIFICATION

| Field | Nilai |
| --- | --- |
| Document ID | AETHER-MTS-001 |
| Version | 0.2.0-draft |
| Status | Engineering specification in progress |
| Master brand | AETHER |
| Platform inti | Aether Weave (working candidate) |
| Signature | By Anomalyid |
| Tagline | The Fabric of Intelligence |

## Peta dokumen

| No | Dokumen | Status |
| --- | --- | --- |
| 01 | Product & Architecture Foundation | Draft |
| 02 | Core Kernel | Draft |
| 03 | Identity, Security & Trust | Draft |
| 04 | Capability, Skills & Plugins | Draft |
| 05 | Agent Runtime & AI Infrastructure | Draft |
| 06 | Protocols, Integrations & Workflow | Draft |
| 07 | Data, API & Developer Platform | Draft |
| 08 | Operations, Deployment & Production | Draft |
| A | ADR Register | 10 accepted, 15 proposed |
| B | Threat Model | Draft |
| C | Riset teknis (MCP, A2A, Skills, WhatsApp, OWASP) | Draft |

## Normative terminology

- **MUST** — wajib dipenuhi; kegagalan membuat implementasi tidak sesuai spesifikasi.
- **MUST NOT** — dilarang.
- **SHOULD** — sangat dianjurkan; penyimpangan wajib memiliki alasan terdokumentasi.
- **SHOULD NOT** — sebaiknya tidak dilakukan.
- **MAY** — opsional.

## Sumber kebenaran

Dokumen ini adalah *single source of truth*. Jika implementasi berbeda dari spesifikasi, perbedaannya wajib dicatat dan diselesaikan melalui ADR — bukan dibiarkan menjadi asumsi.

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

## Gate MVP

MVP bukan dashboard berisi banyak menu. MVP adalah satu skenario end-to-end yang membuktikan fondasi:

```
Event masuk → Normalisasi → Agent Runtime → Context + Skill Resolution
→ Capability Discovery → Authorization → Approval (jika perlu)
→ Capability Execution → Output Validation → Audit + Observability → Hasil
```

Jika alur ini belum bekerja, Aether belum memiliki fondasi agent infrastructure yang terbukti.

## Status implementasi

Fondasi sampai fase 6 sudah dibangun dan diuji, termasuk test MVP end-to-end. Rincian bukti dan batasnya ada di [`../development/implementation-status.md`](../development/implementation-status.md).

## Yang belum boleh diklaim selesai

- API HTTP/OpenAPI dan endpoint aktif.
- Migrasi PostgreSQL sungguhan beserta uji RLS lintas tenant.
- SDK, CLI, Console, dan Studio.
- Security audit formal dan performance benchmark.
- Production deployment.
- Trademark clearance (PDKI / WIPO).

**By Anomalyid.**
