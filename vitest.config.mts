import { configDefaults, defineConfig } from "vitest/config"
import viteConfig from "./vite.config-site.mts"

export default defineConfig({
    ...viteConfig,
    test: {
        exclude: [
            ...configDefaults.exclude,
            ".features-gen/**", // generated files from Playwright BDD tests
            "itsJustJavascript/**",
            "**/dist/**",
            "db/tests/**",
            "adminSiteServer/app.test.ts",
            "adminSiteServer/tests/**",
            "bespoke/**",
        ],
        pool: "threads",
        setupFiles: ["devTools/vitest-setup.ts"],
    },
})
