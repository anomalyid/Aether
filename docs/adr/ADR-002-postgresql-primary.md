# ADR-002 — PostgreSQL sebagai Primary Database

- **Status:** Accepted
- **Tanggal:** 2026-11-25

## Context

Aether membutuhkan penyimpanan transaksional untuk identity, capability, workflow state, audit, dan execution.

## Problem

Memilih sistem penyimpanan utama yang kuat untuk konsistensi, aman untuk multi-tenant, dan tidak menimbulkan lock-in tidak perlu.

## Options

1. PostgreSQL.
2. MySQL.
3. MongoDB / document store.
4. NewSQL distributed database.

## Decision

**PostgreSQL** menjadi primary transactional database. Redis hanya untuk cache, queue, lock, dan data sementara. pgvector dipakai bila retrieval semantik dibutuhkan.

## Reasoning

ACID kuat, JSONB, Row-Level Security, ekosistem mature, mendukung vector via extension, portabel (self-hosted & managed).

## Consequences

- Semua domain menyimpan data transaksi di PostgreSQL.
- Redis **MUST NOT** dipakai sebagai database utama data bisnis tahan lama.

## Security impact

RLS menjadi lapisan tambahan, bukan pengganti authorization aplikasi. Cross-tenant test wajib.

## Operational impact

Perlu migrasi versi, backup, restore test, dan capacity planning sejak awal.

## Migration plan

Tidak direncanakan. Perubahan hanya jika ada kebutuhan yang tidak bisa dipenuhi (ADR baru).

## Review conditions

- Skala melebihi kapasitas single primary.
- Kebutuhan multi-region yang tidak bisa diselesaikan read replica.

## References

Dokumen 07; ADR-011 (proposed).
