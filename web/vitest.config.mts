import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/lib/**/*.ts", "src/modules/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/test/**",
        "src/**/depot.ts",
        "src/**/*-supabase.ts",
        "src/lib/supabase-serveur.ts",
        "src/lib/supabase-auth.ts",
        "src/lib/session.ts",
      ],
      // Seuils minimaux : la vérification automatique échoue si la couverture descend en dessous.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
