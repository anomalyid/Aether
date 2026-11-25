import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@aether/contracts": fromRoot("./packages/contracts/src/index.ts"),
      "@aether/errors": fromRoot("./packages/errors/src/index.ts"),
      "@aether/identifiers": fromRoot("./packages/identifiers/src/index.ts"),
      "@aether/configuration": fromRoot("./packages/configuration/src/index.ts"),
      "@aether/context": fromRoot("./packages/context/src/index.ts"),
      "@aether/kernel": fromRoot("./packages/kernel/src/index.ts"),
      "@aether/identity": fromRoot("./domains/identity/src/index.ts"),
      "@aether/database": fromRoot("./adapters/database/src/index.ts"),
      "@aether/security": fromRoot("./domains/security/src/index.ts"),
      "@aether/capabilities": fromRoot("./domains/capabilities/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "domains/**/*.test.ts",
      "adapters/**/*.test.ts",
      "developer/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
    },
  },
});
