import { ViteEntryPoint } from "./site/viteConstants.ts"
import { defineViteConfigForEntrypoint } from "./vite.config-common.mts"

export default defineViteConfigForEntrypoint(ViteEntryPoint.Site)
