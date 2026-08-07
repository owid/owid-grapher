import { configDefaults, defineConfig } from "vitest/config"
import viteConfig from "./vite.config-site.mts"

export default defineConfig({
    ...viteConfig,
    test: {
        exclude: [
            ...configDefaults.exclude,
            "itsJustJavascript/**",
            "**/dist/**",
            "db/tests/**",
            "adminSiteServer/app.test.ts",
            "adminSiteServer/tests/**",
            "bespoke/**",
        ],
        pool: "threads",
        setupFiles: ["devTools/vitest-setup.ts"],
        benchmark: {
            // benchmarks have their own include/exclude, so the compiled .bench.js
            // files in dist/ would get picked up without this
            exclude: [
                ...configDefaults.exclude,
                "itsJustJavascript/**",
                "**/dist/**",
                "bespoke/**",
            ],
        },
    },
})
