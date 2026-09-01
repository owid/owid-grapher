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
        // Benchmarks (*.bench.ts, run with `yarn bench`) live next to the code
        // they measure. Exclude compiled output so we don't run each bench twice
        // (once from src, once from the tsc-emitted dist copy).
        benchmark: {
            exclude: [
                ...configDefaults.exclude,
                "itsJustJavascript/**",
                "**/dist/**",
                "bespoke/**",
            ],
        },
        pool: "threads",
        setupFiles: ["devTools/vitest-setup.ts"],
    },
})
