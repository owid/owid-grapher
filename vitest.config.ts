import { configDefaults, defineConfig } from "vitest/config"
import viteConfig from "./vite.config-site.mts"

export default defineConfig((env) => ({
    ...viteConfig(env),
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
    },
}))
