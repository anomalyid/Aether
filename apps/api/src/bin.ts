#!/usr/bin/env node
/**
 * Entry point server API Aether.
 *
 * By Anomalyid.
 */

import { buildApi, createMemoryServices, seedDemo } from "./index.js";

const services = createMemoryServices();
if (process.env.AETHER_SEED_DEMO === "true") {
  await seedDemo(services);
}

const app = buildApi({ services });
const port = Number(process.env.PORT ?? 3000);

await app.listen({ port, host: "0.0.0.0" });
