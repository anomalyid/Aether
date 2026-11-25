# Contoh Modul Dasar

Menunjukkan bentuk paling sederhana dari modul Aether yang sah menurut Dokumen 02.

```ts
import { AetherApplication } from "@aether/kernel";
import { contohModul } from "./src/index.js";

const app = AetherApplication.create({ modules: [contohModul] });
await app.start();
console.log(await app.getHealthReport());
await app.shutdown();
```

Aturan yang diperlihatkan contoh ini:

- Manifest memiliki ID bernamespace dan versi yang kompatibel.
- `register()` hanya mendaftarkan contract/service/resource.
- `initialize()` menyiapkan resource, `start()` memulai worker.
- `healthCheck()` tidak mengubah state.
- `stop()` dan `dispose()` terpisah dan aman dipanggil ulang.
- Tidak ada koneksi eksternal saat file di-import.

Contoh ini adalah **ilustrasi**, bukan modul produksi.
