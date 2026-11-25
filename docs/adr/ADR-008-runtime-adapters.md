# ADR-008 — Runtime Adapter

- **Status:** Accepted
- **Tanggal:** 2026-11-25

## Context

Banyak framework agent matang. Kita ingin memakannya tanpa menjadikannya sumber kebenaran.

## Decision

Aether memiliki kontrak runtime sendiri dan **dapat** menggunakan framework eksternal lewat adapter. Framework tidak boleh menjadi source of truth untuk identity, permission, atau execution audit Aether.

## Reasoning

Menghindari vendor lock-in pada framework sekaligus mempercepat pengembangan.

## Consequences

Framework boleh dipilih per use case. Audit dan policy tetap di Aether.

## Security impact

Framework eksternal tidak boleh bypass capability pipeline.

## Migration plan

Ganti framework = ganti adapter.

## Review conditions

- Adapter menjadi lapisan terlalu tebal.

## References

Dokumen 01, 05; AP-005.
