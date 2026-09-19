import { createServer } from "vite"
import { OwidAdminApp } from "../adminSiteServer/appClass.js"
import {
    resetDbButKeepBaselines,
    setupAdminTestDatabase,
} from "../adminSiteServer/tests/adminTestDb.js"

const ADMIN_SERVER_HOST = "localhost"
const ADMIN_SERVER_PORT = 8765
const VITE_HOST = "localhost"
const VITE_PORT = Number(process.env.VITE_PORT ?? 8766)

async function main(): Promise<void> {
    const database = await setupAdminTestDatabase()
    const vite = await createServer({
        configFile: "vite.config-admin.mts",
        server: {
            host: VITE_HOST,
            port: VITE_PORT,
            strictPort: true,
        },
    })
    const app = new OwidAdminApp({ isDev: true, isTest: true, quiet: true })

    await vite.listen()
    await app.startListening(ADMIN_SERVER_PORT, ADMIN_SERVER_HOST)

    let isStopping = false
    const stop = async (): Promise<void> => {
        if (isStopping) return
        isStopping = true

        await resetDbButKeepBaselines(database.testKnex)
        await Promise.allSettled([
            app.stopListening(),
            vite.close(),
            database.testKnex.destroy(),
            database.serverKnex.destroy(),
        ])
    }

    process.once("SIGINT", stop)
    process.once("SIGTERM", stop)

    await new Promise(() => undefined)
}

main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
})
