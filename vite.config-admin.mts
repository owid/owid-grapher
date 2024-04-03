import { VITE_ASSET_ADMIN_ENTRY } from "./site/viteUtils.tsx"
import { defineViteConfigForEntrypoint } from "./vite.config-common.mts"

export default defineViteConfigForEntrypoint(
    "admin",
    VITE_ASSET_ADMIN_ENTRY,
    "dist/assets-admin"
)
