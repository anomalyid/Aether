#!/usr/bin/env node
/**
 * Entry point executable CLI Aether.
 *
 * By Anomalyid.
 */

import { AetherClient } from "@aether/sdk";
import { runCli } from "./index.js";

const env = process.env;
const baseUrl = env.AETHER_BASE_URL;
const tenantId = env.AETHER_TENANT_ID;
const principalId = env.AETHER_PRINCIPAL_ID;

if (baseUrl === undefined || tenantId === undefined || principalId === undefined) {
  const code = await runCli(process.argv.slice(2), { env });
  process.exit(code);
}

const client = new AetherClient({ baseUrl, tenantId, principalId, apiKey: env.AETHER_API_KEY });
const code = await runCli(process.argv.slice(2), { client, env });
process.exit(code);
