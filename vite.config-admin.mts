import { ViteEntryPoint } from "./site/viteUtils.tsx"
import { defineViteConfigForEntrypoint } from "./vite.config-common.mts"

export default defineViteConfigForEntrypoint(ViteEntryPoint.Admin)
