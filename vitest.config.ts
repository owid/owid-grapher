import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        exclude: [
            ...configDefaults.exclude,
            "itsJustJavascript/*",
            "*/dist/*",
            "db/tests/*",
            "adminSiteServer/app.test.ts", // TODO
        ],
    },
})
