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
    // `data/` holds the hand-built data files (see scripts/buildData.py) so the
    // dev server can serve them at /deforestation-trade/<file>; they are not
    // part of the production bundle, which fetches them from the bucket.
    publicDir: "data",
    build: {
        copyPublicDir: false,
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
