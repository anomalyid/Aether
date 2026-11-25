# Riset — Integrasi WhatsApp

WhatsApp adalah **salah satu** demonstrasi kemampuan Aether, bukan identitas platform.

## 1. Jalur resmi — WhatsApp Business Platform Cloud API

Diprioritaskan untuk kebutuhan bisnis/komersial.

### Prasyarat

- WhatsApp Business Account (WABA) diperlukan untuk mengirim/menerima pesan dan mengelola template.
- Business portfolio (Meta Business Suite) diperlukan.
- Permission: `whatsapp_business_messaging` (pesan & call), `whatsapp_business_management` (webhook lain).
- Partner yang menyediakan layanan untuk bisnis lain butuh advanced access via App Review.

### Webhook

- GET verifikasi endpoint: `hub.mode=subscribe`, `hub.challenge`, `hub.verify_token`. Bandingkan `verify_token` dengan string tersimpan; balas 200 + `hub.challenge` jika cocok, 400 jika tidak.
- POST: header `X-Hub-Signature-256: sha256=<HMAC>`, dihitung dari body dengan **app secret** sebagai kunci. Validasi sebelum memproses.
- Payload hingga **3 MB**.
- Meta retry hingga **7 hari** dengan frekuensi menurun → **duplikat wajib ditangani** (dedup).
- POST dibatch hingga 1000 update, tetapi batching tidak dijamin — tangani tiap request secara individual.
- mTLS didukung untuk keamanan tambahan.
- Tidak ada API untuk mengambil histori webhook → simpan payload yang diterima.
- Balas 200 setelah valid; selain itu dianggap gagal.

### Field menarik

`messages`, `message_template_status_update`, `account_update`, `account_alerts`, `phone_number_quality_update`, `user_preferences`, `calls`, dan lain-lain.

Identitas user: `wa_id` dan `from` dapat dihilangkan jika user memakai username; gunakan **BSUID** (`user_id` / `from_user_id`) untuk identifikasi.

## 2. Jalur tidak resmi — Baileys

`@whiskeysockets/baileys`, MIT, repository resmi komunitas `WhiskeySockets/Baileys`. Versi `latest` 7.0.0-rc14, `legacy` 6.7.24 (per Nov 2026).

Fakta penting:

- **Tidak afiliasi dengan WhatsApp.** Memakai WhatsApp Web WebSocket via Linked Devices, bukan WhatsApp Business API.
- `useMultiFileAuthState` **TIDAK direkomendasikan untuk produksi** — I/O disk berat, tidak scalable, berisiko auth error.Gunakan hanya untuk development/simple bot.
- Produksi wajib memakai auth state berbasis database yang mengimplementasikan `SignalKeyStore` (`get`, `set`, opsional `clear`). `set` harus persist sebelum resolve.
- Setiap kirim/terima pesan dapat mengubah Signal keys (`authState.keys.set()`). Jika tidak disimpan, pesan gagal terkirim/dekripsi.
- `creds.update` wajib dihubungkan ke `saveCreds` pada setiap socket.
- `makeCacheableSignalKeyStore` mengurangi I/O disk (TTL default 5 menit).
- Folder/kredensial auth setara private key SSH — **MUST NOT** masuk version control.
- Baileys stateless: tidak menyimpan chat, pesan, atau kontak. Aplikasi sendiri yang membangun state dari event.
- v7 membawa breaking changes (LID, auth-state). Minimal 6.7.22 atau 7.0.0-rc12 untuk patch advisory kritis.
- Tidak ada end-of-support policy resmi; pernyataan maintainer: LTS through 2027 (26 Okt 2026).

## 3. Keputusan Aether

```
messaging.domain
    ↓
whatsapp.provider.interface
    ├── official_cloud_adapter   (prioritas produksi)
    └── experimental_baileys_adapter (eksperimental)
```

- Provider abstraction mencegah platform terkunci pada satu library.
- Session Manager, credential encryption, isolasi akun, lifecycle, dan recovery menjadi tanggung jawab **Integration Domain**, bukan Agent Runtime.
- Hormati consent penerima, kebijakan provider, pembatasan pesan, dan opt-out.
- Normalisasi ke `UnifiedMessage` (lihat Dokumen 06).
- Webhook diverifikasi + idempoten + audit.

## Status

Riset selesai 2026-11-25. Cek ulang dokumentasi Meta dan baileys.wiki sebelum implementasi adapter.
