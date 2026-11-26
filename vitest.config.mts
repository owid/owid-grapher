import { configDefaults, defineConfig } from "vitest/config"
import viteConfig from "./vite.config-site.mts"

export default defineConfig({
    ...viteConfig,
    test: {
        exclude: [
            ...configDefaults.exclude,
            ".claude/worktrees/**", // local checkouts are separate test suites
            ".features-gen/**", // generated files from Playwright BDD tests
            "itsJustJavascript/**",
            "**/dist/**",
            "db/tests/**",
            "adminSiteServer/app.test.ts",
            "adminSiteServer/tests/**",
            "bespoke/**",
            "playwright/**",
        ],
        pool: "threads",
        setupFiles: ["devTools/vitest-setup.ts"],
        benchmark: {
            // Benchmarks run from source, so every cross-module access goes
            // through a module-runner getter. That overhead is the same for
            // the branches being compared, and we can't skip the transforms
            suppressExportGetterWarnings: true,
        },
    },
})
