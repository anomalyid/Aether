# ADR-009 — TypeScript First

- **Status:** Accepted
- **Tanggal:** 2026-11-25

## Context

Perlu bahasa utama untuk platform, API, CLI, dan SDK.

## Decision

**TypeScript** menjadi bahasa utama. Python dipakai untuk kebutuhan AI/data yang memang lebih sesuai.

## Reasoning

Typed contracts, ekosistem Node matang, satu bahasa untuk backend/CLI/SDK, kemudahan AI coding agent.

## Consequences

Node.js LTS ≥ 22.12. Versi dependency dipatok. Python SDK menyusul setelah API stabil.

## Security impact

Typing mengurangi class of bug, bukan menggantikan security test.

## Migration plan

Tidak direncanakan.

## Review conditions

- Kebutuhan performa/ekosistem yang tidak bisa dipenuhi Node.

## References

Dokumen 01, 07.
