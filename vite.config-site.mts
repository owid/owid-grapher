import { ViteEntryPoint } from "./site/viteUtils.tsx"
import { defineViteConfigForEntrypoint } from "./vite.config-common.mts"
import { webpackStats } from "rollup-plugin-webpack-stats"

export default defineViteConfigForEntrypoint(ViteEntryPoint.Site, [
    // Output webpack-stats.json file
    webpackStats(),
])
