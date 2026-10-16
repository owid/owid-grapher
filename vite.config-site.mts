import { ViteEntryPoint } from "./site/viteConstants.mts"
import { defineViteConfigForEntrypoint } from "./vite.config-common.mts"

export default defineViteConfigForEntrypoint(ViteEntryPoint.Site)
