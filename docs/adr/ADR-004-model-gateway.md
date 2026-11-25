# ADR-004 — Model Gateway Abstraction

- **Status:** Accepted
- **Tanggal:** 2026-11-25

## Context

Aether harus model-agnostic. Provider AI berubah cepat, dan bisnis tidak boleh terikat pada satu vendor.

## Decision

Seluruh akses model AI melewati **Model Gateway**. Agent tidak boleh memiliki ketergantungan langsung pada provider tertentu.

## Reasoning

Routing, fallback, token accounting, cost tracking, dan privasi data dapat dikelola pusat. Vendor lock-in ditekan.

## Consequences

Interface `generate`, `stream`, `embeddings` menjadi kontrak. Adapter wajib melaporkan model aktual, usage, finish reason, error.

## Security impact

Fallback diam-diam dilarang bila memengaruhi keamanan/kualitas. Lokasi pemrosesan data dapat dievaluasi.

## Migration plan

Tambah provider baru = tambah adapter, tanpa ubah agent.

## Review conditions

- Gateway menjadi bottleneck terbukti.

## References

Dokumen 05; AP-006.
