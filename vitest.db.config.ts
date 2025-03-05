import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: ["db/tests/**/*.test.js", "adminSiteServer/app.test.ts"],
        maxConcurrency: 1,
    },
})
