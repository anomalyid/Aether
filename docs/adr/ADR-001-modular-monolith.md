# ADR-001 — Modular Monolith sebagai Arsitektur Awal

- **Status:** Accepted
- **Tanggal:** 2026-11-25
- **ID:** ADR-001

## Context

Aether direncanakan sebagai platform dengan 13 domain. Kita perlu memilih bentuk deployment dan batas proses sejak awal agar tidak melakukan rewrite besar-besaran kemudian.

## Problem

Microservices memberi isolasi dan independent deployment, tetapi menambah kompleksitas operasional, jaringan, transaksi terdistribusi, dan debugging pada tahap ketika tim dan kebutuhan skala belum terbukti.

## Constraints

- Tim awal kecil.
- Belum ada benchmark skala.
- Transaksi lintas domain masih sering terjadi (identity + policy + execution + audit).
- Fondasi harus mudah di-debug dan diuji.

## Options

1. Microservices sejak awal.
2. Modular monolith dengan batas domain ketat.
3. Serverless 함수 per-fitue.

## Decision

**Modular monolith** dipilih sebagai arsitektur awal. Domain tetap dibatasi tegas dan dapat dipisahkan kemudian.

## Reasoning

Mempercepat pembangunan, memudahkan debugging, memudahkan transaksi lintas domain, mengurangi kompleksitas deployment, dan memungkinkan pemisahan service saat kebutuhan sudah jelas.

## Consequences

- Domain **MUST NOT** mengakses repository internal domain lain.
- Batas domain tetap tegas meski berada dalam satu proses.
- Komunikasi antar-domain lewat interface atau event.
- Batas modul diverifikasi CI (dependency graph).

## Security impact

Isolasi proses belum ada; oleh karena itu isolasi logika (deny-by-default, tenant context, authorization) wajib lebih ketat.

## Operational impact

Satu deployment, satu database. Operasional sederhana.

## Migration plan

Jika salah satu domain butuh isolasi keamanan, scaling, atau deployment independence, ekstrak ke service terpisah lewat ADR baru. Kontrak domain sudah dirancang untuk ini.

## Review conditions

- Tim > 5 engineer dengan kepemilikan domain jelas.
- Beban kerja berbeda secara signifikan antar-domain.
- Kebutuhan isolasi keamanan tingkat proses.

## References

Dokumen 01, 02; AP-001; AP-015.
