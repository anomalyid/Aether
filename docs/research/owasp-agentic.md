# Riset — OWASP Top 10 for Agentic Applications 2026

Sumber: https://genai.owasp.org/top-10-for-agentic-applications-2026/

## Daftar risiko

| ID | Risiko | Arti singkat |
| --- | --- | --- |
| ASI01 | Agent Goal Hijack | Tujuan/logika agent dialihkan lewat prompt injection, konten beracun, email, atau dokumen yang dibaca agent |
| ASI02 | Tool Misuse & Exploitation | Tool sah disalahgunakan karena injection, misalignment, atau metadata beracun |
| ASI03 | Identity & Privilege Abuse | Penyalahgunaan identitas/izin agent, eskalasi privilege, delegasi berlebihan |
| ASI04 | Agentic Supply Chain | Package, plugin, skill, model, atau dependency yang disusupi |
| ASI05 | Unexpected Code Execution | Kode eksternal atau tool menjalankan aksi di luar batas |
| ASI06 | Memory & Context Poisoning | Memori/context diracuni sehingga keputusan agent bias |
| ASI07 | Insecure Inter-Agent Communication | Komunikasi antar-agent tanpa autentikasi/otorisasi memadai |
| ASI08 | Cascading Failures | Kegagalan satu komponen menjalar ke seluruh sistem |
| ASI09 | Human-Agent Trust Exploitation | Manusia terlalu percaya pada output agent atau approval yang menyesatkan |
| ASI10 | Rogue Agents | Agent menyimpang dari fungsi atau dikompromi, bertindak sebagai aktor jahat |

## Rekomendasi OWASP yang diadopsi Aether

- **Least privilege** untuk semua tool agent; minta human approval untuk aksi berdampak tinggi atau mengubah tujuan.
- **Minimize goal hijack** dengan memisahkan instruksi tepercaya dari data tidak tepercaya.
- **Sandboxing** untuk eksekusi kode.
- **Approval** yang terikat pada aksi spesifik, bukan persetujuan umum.
- **Audit** setiap keputusan otorisasi dan eksekusi.
- **Supply chain controls**: lockfile, signature, provenance, verifikasi publisher.
- **Budget, timeout, circuit breaker, kill switch** untuk mencegah cascading failure.
- **Agent identity, run limit, revocation, monitoring** untuk rogue agents.

## Posisi Aether

Risiko-risiko ini menjadi **input threat model**, bukan sekadar checklist dokumentasi. Setiap domain yang berhubungan dengan agent, tools, memory, plugin, atau komunikasi antar-agent wajib memetakan kontrolnya ke daftar ini.

Lihat [`../security/threat-model.md`](../security/threat-model.md).

## Status

Riset selesai 2026-11-25. OWASP memperbarui dokumen secara berkala — lakukan review periodik.
