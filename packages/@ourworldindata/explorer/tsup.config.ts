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

    // Needed for imports of `react-aria-components` to work correctly
    // This doesn't bundle any "import" calls, meaning the output files can't be used in a browser directly,
    // but need to be bundled again in another step. This is what we do anyway.
    skipNodeModulesBundle: true,
})
