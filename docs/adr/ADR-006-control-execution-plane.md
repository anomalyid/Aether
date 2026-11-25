# ADR-006 — Control Plane dan Execution Plane

- **Status:** Accepted
- **Tanggal:** 2026-11-25

## Context

Konfigurasi/identitas memiliki kebutuhan keamanan berbeda dari eksekusi agent/tools.

## Decision

**Control plane** mengatur konfigurasi, registry, identitas, dan kebijakan. **Execution plane** menjalankan agent, workflow, dan integrasi.

## Reasoning

Memisahkan perubahan state kepercayaan dari eksekusi berisiko tinggi. Memungkinkan scaling worker tanpa mengubah registry.

## Consequences

Keduanya boleh satu deployment pada tahap awal, tetapi batas tanggung jawab tetap terpisah.

## Security impact

Execution worker tidak boleh memiliki hak menulis policy/identity.

## Migration plan

Pemisahan fisik dapat dilakukan lewat ADR baru.

## Review conditions

- Isolation atau scaling menuntut pemisahan proses.

## References

Dokumen 01, 08.
