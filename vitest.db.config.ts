import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: ["db/tests/*", "adminSiteServer/app.test.ts"],
        maxConcurrency: 1,
    },
})
