import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@aether/errors": fileURLToPath(new URL("./packages/errors/src/index.ts", import.meta.url)),
      "@aether/identifiers": fileURLToPath(new URL("./packages/identifiers/src/index.ts", import.meta.url)),
      "@aether/events": fileURLToPath(new URL("./packages/events/src/index.ts", import.meta.url)),
      "@aether/contracts": fileURLToPath(new URL("./packages/contracts/src/index.ts", import.meta.url)),
      "@aether/identity": fileURLToPath(new URL("./domains/identity/src/index.ts", import.meta.url)),
      "@aether/security": fileURLToPath(new URL("./domains/security/src/index.ts", import.meta.url)),
      "@aether/capabilities": fileURLToPath(new URL("./domains/capabilities/src/index.ts", import.meta.url)),
      "@aether/agents": fileURLToPath(new URL("./domains/agents/src/index.ts", import.meta.url)),
      "@aether/workflows": fileURLToPath(new URL("./domains/workflows/src/index.ts", import.meta.url)),
      "@aether/skills": fileURLToPath(new URL("./domains/skills/src/index.ts", import.meta.url)),
      "@aether/database": fileURLToPath(new URL("./adapters/database/src/index.ts", import.meta.url)),
      "@aether/provider-whatsapp": fileURLToPath(new URL("./adapters/providers/whatsapp/src/index.ts", import.meta.url)),
      "@aether/mcp": fileURLToPath(new URL("./protocols/mcp/src/index.ts", import.meta.url)),
      "@aether/a2a": fileURLToPath(new URL("./protocols/a2a/src/index.ts", import.meta.url)),
      "@aether/api": fileURLToPath(new URL("./apps/api/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
