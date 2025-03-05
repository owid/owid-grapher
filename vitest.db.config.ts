import { defineConfig } from "vitest/config"
import viteConfig from "./vite.config-site.mts"

export default defineConfig({
    ...viteConfig,
    test: {
        include: ["db/tests/**/*.test.js", "adminSiteServer/app.test.ts"],
        maxConcurrency: 1,
    },
})
