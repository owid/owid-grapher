import { defineConfig } from "vitest/config"
import viteConfig from "./vite.config-site.mts"

export default defineConfig({
    ...viteConfig,
    test: {
        include: [
            "db/tests/**/*.test.ts",
            "db/tests/**/*.test.js",
            "adminSiteServer/tests/**/*.test.ts",
        ],
        maxConcurrency: 1,
        fileParallelism: false,
        pool: "threads",
        poolOptions: { threads: { singleThread: true } },
        sequence: { concurrent: false },
        setupFiles: [
            "devTools/vitest-setup.ts",
            "adminSiteServer/tests/setupDbTest.ts",
        ],
    },
})
