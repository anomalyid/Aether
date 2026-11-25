# CONTRIBUTING.md — Panduan Kontribusi Aether

Terima kasih telah berkontribusi pada Aether. Kontribusi yang baik bukan sekadar kode yang berjalan, melainkan kode yang sesuai kontrak, teruji, dan terdokumentasi.

## Alur kerja

```
Requirement → Research → Architecture Review → Implementation Plan
→ Code Generation → Automated Tests → Security Review
→ Independent Code Review → Human Approval → Release → Monitoring
```

## Langkah praktis

1. Baca `README.md`, `ARCHITECTURE.md`, dan `AGENTS.md`.
2. Pastikan perubahan Anda masuk ke domain yang tepat.
3. Jika menyangkut kontrak publik, buat ADR terlebih dahulu.
4. Buat branch dari `main` dengan nama deskriptif.
5. Tulis kode + test.
6. Jalankan:

```bash
pnpm install
pnpm build
pnpm test
```

7. Pastikan tidak ada secret, token, atau kredensial yang ikut ter-commit.
8. Buat pull request dengan deskripsi: masalah, keputusan, risiko, dan cara pengujian.

## Commit message

Gunakan Bahasa Indonesia, format:

```
<tipe>: <ringkasan singkat>

<penjelasan opsional>
```

Tipe yang digunakan: `tambah`, `perbaiki`, `dokumen`, `arsitektur`, `test`, `refactor`, `keamanan`, `infra`.

Contoh:

```
tambah: sistem lifecycle dan dependency graph pada kernel

Menambahkan validasi manifest, deteksi siklus, dan rollback startup.
```

## Standar kode

- TypeScript strict mode.
- Versi dependency **dipatok**, bukan `latest` atau `*` (kecuali `workspace:*`).
- Setiap modul memiliki manifest dan kontrak.
- Error harus dinormalisasi ke `AetherError`.
- Token dan kredensial tidak boleh masuk log.

## Review checklist

- [ ] Sesuai arsitektur dan ADR.
- [ ] Test lulus.
- [ ] Tidak ada circular dependency.
- [ ] Permission dan tenant boundary diperiksa.
- [ ] Dokumentasi diperbarui.
- [ ] Tidak ada perubahan di luar scope.
- [ ] Tidak ada secret yang terekspos.

## Pelaporan kerentanan

Jangan buat issue publik untuk kerentanan. Ikuti prosedur di [`SECURITY.md`](SECURITY.md).
