import { defineConfig } from "vite"
import { commonPlugins, defineViteConfigForEntrypoint } from "../../vite.config-common.mts"
import { ViteEntryPoint } from "../../site/viteConstants.js"

const site = defineViteConfigForEntrypoint(ViteEntryPoint.Site)
export default defineConfig({
    ...site,
    plugins: commonPlugins(),
    root: "features/grapher",
    publicDir: "../../public",
    build: {
        ...site.build,
        outDir: "../../dist/grapher-browser-tests",
        rolldownOptions: { input: "features/grapher/index.html" },
    },
    preview: { host: "127.0.0.1", port: 8791, strictPort: true },
})
