# Riset — Agent Skills Format

## Ringkasan

Agent Skills adalah format terbuka untuk memperluas kemampuan agent dengan pengetahuan dan workflow prosedural. Diadopsi luas (Claude Code, Cursor, VS Code, GitHub Copilot, Gemini CLI, OpenAI Codex, dan lain-lain). Spesifikasi vendor-neutral: https://agentskills.io/specification.

## Struktur direktori

```
skill-name/
├── SKILL.md          # WAJIB: frontmatter + instruksi
├── scripts/          # opsional: kode executable
├── references/       # opsional: dokumentasi tambahan
└── assets/           # opsional: template & resource statis
```

## Frontmatter SKILL.md

| Field | Wajib | Batasan |
| --- | --- | --- |
| `name` | Ya | 1–64 char, lowercase alphanumeric + hyphen, tidak diawali/akhiri hyphen, tidak ada `--`, **harus sama dengan nama folder** |
| `description` | Ya | 1–1024 char, menjelaskan apa skill dilakukan **dan kapan dipakai**, mengandung keyword yang membantu agent mengenali tugas |
| `license` | Tidak | Nama lisensi atau referensi file lisensi |
| `compatibility` | Tidak | ≤500 char, kebutuhan environment (produk, package, network) |
| `metadata` | Tidak | Map string→string untuk data tambahan |
| `allowed-tools` | Tidak | String tool yang pre-approved, dipisah spasi (eksperimental) |

Aturan: field recognized harus lowercase dan hanya muncul sekali. Field duplicate, casing salah, atau tipe collection pada field scalar membuat skill gagal dimuat. Field top-level tidak dikenal diabaikan untuk forward compatibility.

## Progressive disclosure

1. **Discovery/catalog** — `name` + `description` saja (~50–100 token per skill) dimuat di startup.
2. **Activation/load** — isi lengkap `SKILL.md` (<5000 token disarankan) dimuat saat tugas cocok dengan deskripsi.
3. **Resources** — file di `references/`, `assets/` dimuat hanya saat diperlukan.
4. **Scripts** — dijalankan hanya saat diperlukan (implementasi tertentu menyediakan `run_skill_script`).

Rekomendasi: `SKILL.md` <500 baris; pindahkan material detail ke `references/`; referensi file relatif terhadap root skill dan sedalam satu level; gunakan `skills-ref validate ./my-skill` untuk validasi.

## Implikasi untuk Aether

Aether mengadopsi format ini, bukan membuat format sendiri tanpa alasan. Tetapi menambahkan governance internal:

- Skill Registry + versioning + dependency manifest.
- Signature / provenance dan permission manifest.
- Compatibility check dan security scanning.
- Installation, uninstallation, rollback, audit trail, trust level.

Konsekuensi penting: **Skill bukan izin dan bukan jaminan aman.** Skill dengan script diperlakukan sebagai kode untrusted sampai divalidasi dan diisolasi. Skill yang terpasang tidak otomatis mendapat permission.

Lifecycle Aether: `DISCOVERED → PARSED → VALIDATED → SECURITY_SCANNED → DEPENDENCIES_RESOLVED → REGISTERED → ENABLED → DISABLED → UNINSTALLED`.

Trust level: Built-in, Verified, Organization, Community, Untrusted. Trust level bukan pengganti authorization.

## Status

Riset selesai 2026-11-25. Cek ulang https://agentskills.io/specification sebelum implementasi Skill loader/validator.
