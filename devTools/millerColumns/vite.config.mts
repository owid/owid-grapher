import path from "node:path"
import { defineConfig, loadEnv } from "vite"

// Standalone prototype: none of the site's Vite setup applies here.
// Live charts come from this checkout's admin server (its .env port).
const env = loadEnv("", path.join(import.meta.dirname, "../.."), "")
export default defineConfig({
    root: import.meta.dirname,
    server: { port: Number(process.env.PORT ?? 8470), strictPort: true },
    define: {
        __LOCAL_SITE__: JSON.stringify(
            `http://localhost:${env.ADMIN_SERVER_PORT ?? 3030}`
        ),
    },
})
