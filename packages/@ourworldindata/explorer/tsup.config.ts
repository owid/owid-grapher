import { defineConfig } from "tsup"
import { sassPlugin } from "esbuild-sass-plugin"

export default defineConfig({
    dts: true,
    sourcemap: true,
    splitting: true,
    clean: true,
    format: "esm",
    esbuildPlugins: [sassPlugin()],
    tsconfig: "./tsconfig.json",
})
