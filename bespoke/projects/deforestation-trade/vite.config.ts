import { defineConfig } from "vite"
import pluginReact from "@vitejs/plugin-react"
import { viteCssPosition } from "vite-plugin-css-position"

import { pluginSwcDecorators } from "../../../rolldown.config-common.mts"
import { DEDUPED_PACKAGES } from "../../shared/viteDedupe.js"
import { entrypoints } from "./package.json"

export default defineConfig({
    plugins: [
        pluginSwcDecorators(),
        pluginReact(),
        // This plugin allows us to Vite-inject styles directly into the Shadow DOM, and still use HMR in development.
        // Use <StylesTarget /> in the React tree to specify where the styles should be injected.
        viteCssPosition({
            enableDev: true,
        }),
    ],
    resolve: {
        dedupe: DEDUPED_PACKAGES,
    },
    // `data/` holds the hand-built data files (see scripts/buildData.py). The
    // dev server serves them at /deforestation-trade/<file>, and the build
    // copies them next to index.js, where the registry's `dataBundled` entry
    // points. Both go once an ETL step publishes the data.
    publicDir: "data",
    build: {
        lib: {
            entry: entrypoints.js,
            formats: ["es"],
            fileName: "index",
        },
        sourcemap: true,
        outDir: "dist",
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify(
            process.env.NODE_ENV || "development"
        ),
    },
})
