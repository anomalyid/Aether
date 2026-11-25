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
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
    },
  },
});
