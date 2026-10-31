import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: "node",
            environment: "node",
            include: [
              "src/engine/**/*.test.ts",
              "src/store/**/*.test.ts",
              "src/ui/**/geometry.test.ts",
            ],
          },
        },
        {
          extends: true,
          test: {
            name: "dom",
            environment: "jsdom",
            include: [
              "src/ui/**/*.test.tsx",
              "src/App.test.tsx",
              "src/test/**/*.test.tsx",
            ],
            setupFiles: ["src/test/setup.ts"],
          },
        },
      ],
    },
  }),
);
