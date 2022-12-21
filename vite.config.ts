import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        manifest: true,
        emptyOutDir: false,
        outDir: "dist",
        sourcemap: true,
        lib: {
            entry: {
                owid: "./site/owid.entry.ts",
                // admin: "./adminSiteClient/admin.entry.ts",
            },
            formats: ["es"],
        },
    },
    plugins: [react()],
    server: {
        port: 8090,
    },
})
