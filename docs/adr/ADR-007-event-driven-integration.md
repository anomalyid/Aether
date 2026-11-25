# ADR-007 — Event-Driven Integration

- **Status:** Accepted
- **Tanggal:** 2026-11-25

## Context

Integrasi eksternal (webhook, MCP, queue) menghasilkan event yang bisa duplikat, tertunda, atau gagal dikirim.

## Decision

Integrasi eksternal dinormalisasi menjadi event internal. Pengiriman memakai mekanisme yang mendukung retry, deduplication, dan observability.

## Reasoning

Menghindari coupling langsung ke provider dan kehilangan event saat transaksi gagal.

## Consequences

- Event envelope wajib: id, type, version, tenant, timestamp, correlation, source, data.
- Transactional outbox wajib.
- Consumer wajib idempotent.

## Security impact

Event dari provider diperlakukan untrusted sampai diverifikasi (HMAC, signature).

## Migration plan

Broker dapat diganti tanpa ubah domain lewat adapter.

## Review conditions

- Volume event melebihi kapasitas queue awal.

## References

Dokumen 06; ADR-015 (proposed).
