/**
 * Contoh modul minimal Aether.
 *
 * Modul ini menunjukkan lifecycle lengkap tanpa bergantung pada domain apa pun.
 * Jalankan dengan melihat test di packages/kernel/src/bootstrap.test.ts.
 *
 * By Anomalyid.
 */

import { defineModule } from "@aether/kernel";

export const contohModul = defineModule({
  manifest: {
    id: "aether.contoh",
    name: "Contoh Modul",
    version: "1.0.0",
    description: "Modul contoh untuk mendemonstrasikan lifecycle Aether",
    runtime: {
      package: "@aether/contoh",
      entrypoint: "./dist/index.js",
    },
    compatibility: {
      kernel: "^0.1.0",
      contracts: "^0.1.0",
    },
    dependencies: { required: [], optional: [] },
    provides: { contracts: ["contoh.health.v1"] },
    requires: { contracts: [] },
    permissions: { requested: [] },
    lifecycle: { startupPriority: 100, shutdownTimeoutMs: 5000 },
    health: { enabled: true },
  },

  async register(context) {
    context.registerContract({
      id: "contoh.health.v1",
      version: "1.0.0",
      ownerModule: "aether.contoh",
      stability: "experimental",
      compatibility: { minimumKernelVersion: "0.1.0" },
      description: "Kontrak health sederhana untuk contoh",
    });
  },

  async initialize() {
    // Validasi konfigurasi dan persiapkan resource di sini.
  },

  async start() {
    // Mulai worker/consumer di sini. Jangan lakukan ini saat import file.
  },

  async healthCheck() {
    return {
      status: "healthy",
      checkedAt: new Date().toISOString(),
      message: "Modul contoh sehat",
    };
  },

  async stop() {
    // Hentikan penerimaan pekerjaan baru.
  },

  async dispose() {
    // Bersihkan resource yang dimiliki modul.
  },
});
