# ADR-010 — No Premature Microservices

- **Status:** Accepted
- **Tanggal:** 2026-11-25

## Context

Arsitektur besar sering tergoda memisahkan layanan agar terlihat "skalabel".

## Decision

**Tidak ada pemisahan microservices** tanpa alasan terbukti: skala, isolasi keamanan, deployment independence, atau kebutuhan operasional.

## Reasoning

Microservices menambah biaya operasional, jaringan, observability, dan kegagalan parsial. Aether belum memilikinya pada tahap awal.

## Consequences

Setiap usulan service baru wajib ADR dengan bukti.

## Security impact

Isolasi logika lebih penting daripada isolasi proses pada tahap awal.

## Migration plan

Ekstraksi service dimungkinkan karena batas domain sudah jelas.

## Review conditions

Lihat kriteria Technology Adoption Policy dan ADR-001.

## References

ADR-001; Dokumen 01.
