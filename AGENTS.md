# AGENTS.md — Aturan untuk AI Coding Agent

Dokumen ini mengikat setiap agen coding (manusia maupun AI) yang bekerja di repository Aether.

## Wajib sebelum mengubah kode

1. Baca [`ARCHITECTURE.md`](ARCHITECTURE.md) dan dokumen di [`docs/specifications/`](docs/specifications/).
2. Baca ADR yang relevan di [`docs/adr/`](docs/adr/).
3. Pahami domain mana yang Anda sentuh. Jangan menulis ke domain lain.
4. Jika kontrak publik berubah, buat ADR baru terlebih dahulu.

## Larangan keras

- ❌ Jangan mengubah kontrak publik tanpa ADR.
- ❌ Jangan membuat migration destruktif tanpa review manusia.
- ❌ Jangan menonaktifkan security test untuk meloloskan build.
- ❌ Jangan menambahkan dependency tanpa alasan terdokumentasi + versi dipatok.
- ❌ Jangan mengubah file di luar scope task.
- ❌ Jangan menjalankan kode eksternal di proses utama.
- ❌ Jangan menaruh secret di source code, log, prompt, atau error message.
- ❌ Jangan mengklaim fitur selesai jika belum diuji.
- ❌ Jangan mengunci platform pada satu vendor AI atau satu provider integrasi.
- ❌ Jangan membuat microservices baru tanpa ADR yang membuktikan kebutuhannya.

## Aturan arsitektur

- `packages/` hanya primitive umum. Tidak boleh mengetahui detail produk.
- `domains/` memiliki public interface. Internal implementation tidak diekspos.
- `adapters/` mengimplementasikan contracts dari `packages/` dan `domains/`.
- Domain **dilarang** mengakses tabel internal domain lain secara langsung.
- Tidak boleh ada circular dependency. CI akan memeriksanya.
- Semua permission default adalah **deny**.
- Setiap execution wajib memiliki principal, tenant context, correlation ID, dan audit.
- Setiap resource wajib memiliki owner dan `dispose()`.

## Aturan testing

- Setiap perubahan wajib menyertakan test yang relevan.
- Jalankan `pnpm build` dan `pnpm test` sebelum selesai.
- Laporkan keterbatasan test secara jujur.
- Test keamanan dan isolasi tenant **tidak boleh** dilewati.

## Format penamaan

- Nama package internal: `@aether/<nama-teknis>` (huruf kecil, hyphen).
- Nama produk: `Aether <Product Name>`.
- Nama file konfigurasi: lowercase, gunakan `.md` untuk dokumentasi.
- Identifier kode: English. Dokumentasi dan komunikasi: **Bahasa Indonesia**.

## Definition of Done

Sebuah modul dinyatakan selesai hanya jika memiliki:

- source code
- module manifest
- interface / kontrak
- schema
- lifecycle
- permission model
- error handling
- unit test
- integration test
- security test
- dokumentasi
- observability
- migration strategy
- compatibility test
- acceptance criteria

## Bahasa

Seluruh komunikasi, dokumentasi, dan commit message ditulis dalam **Bahasa Indonesia**. Identifier kode tetap menggunakan English sesuai konvensi pemrograman.
