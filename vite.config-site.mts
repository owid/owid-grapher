import { VITE_ASSET_SITE_ENTRY } from "./site/viteUtils.tsx"
import { defineViteConfigForEntrypoint } from "./vite.config-common.mts"

export default defineViteConfigForEntrypoint(
    "owid",
    VITE_ASSET_SITE_ENTRY,
    "dist/assets"
)
