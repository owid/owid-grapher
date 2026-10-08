/**
 * Starts the stack the admin browser tests run against: the admin server and
 * builds of the admin and site clients, on a freshly reset test
 * database seeded with the synthetic indicators from `fixture.ts`, plus a
 * stand-in for the data API that serves those indicators' data and metadata
 * files.
 *
 * Tests only ever add rows (every test seeds its own charts), so the seeded
 * indicators are shared read-only by all workers.
 */
import http from "node:http"
import { type Knex } from "knex"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { createServer, type ViteDevServer } from "vite"
import {
    ChartConfigsTableName,
    DatasetsTableName,
    DodsTableName,
    EntitiesTableName,
    NamespacesTableName,
    TagsTableName,
    VariablesTableName,
} from "@ourworldindata/types"
import { OwidAdminApp } from "../../adminSiteServer/appClass.js"
import {
    resetDbButKeepBaselines,
    setupAdminTestDatabase,
} from "../../adminSiteServer/tests/adminTestDb.js"
import {
    allIndicators,
    datasets,
    dods,
    entities,
    indicatorData,
    indicatorMetadata,
    tags,
} from "./fixture.js"
import {
    ADMIN_SERVER_PORT,
    DATA_API_PORT,
    HOST,
    TEST_VITE_DIST_DIR,
    VITE_PORT,
    useViteDevServer,
} from "./ports.js"

async function seedFixture(knex: Knex, userId: number): Promise<void> {
    const now = new Date()
    const namespaces = [
        ...new Set(Object.values(datasets).map((d) => d.namespace)),
    ]
    await knex(NamespacesTableName)
        .insert(namespaces.map((name) => ({ name, description: name })))
        .onConflict("name")
        .ignore()

    await knex(EntitiesTableName)
        .insert(
            Object.values(entities).map((entity) => ({
                ...entity,
                validated: true,
            }))
        )
        .onConflict("id")
        .merge()

    await knex(DatasetsTableName).insert(
        Object.values(datasets).map((dataset) => ({
            ...dataset,
            description: "",
            createdByUserId: userId,
            metadataEditedAt: now,
            metadataEditedByUserId: userId,
            dataEditedAt: now,
            dataEditedByUserId: userId,
        }))
    )

    for (const indicator of allIndicators) {
        let patchConfigIdETL: string | undefined
        if (indicator.grapherConfigETL) {
            patchConfigIdETL = crypto.randomUUID()
            await knex(ChartConfigsTableName).insert({
                id: patchConfigIdETL,
                config: JSON.stringify(indicator.grapherConfigETL),
            })
        }
        await knex(VariablesTableName).insert({
            id: indicator.id,
            name: indicator.name,
            unit: indicator.unit,
            shortUnit: indicator.shortUnit,
            descriptionShort: indicator.descriptionShort,
            type: indicator.type,
            datasetId: indicator.dataset.id,
            catalogPath: indicator.catalogPath,
            display: JSON.stringify(indicator.display ?? {}),
            coverage: "",
            timespan: "",
            columnOrder: 0,
            schemaVersion: 2,
            patchConfigIdETL,
        })
    }

    await knex(TagsTableName).insert(tags)
    await knex(DodsTableName)
        .insert(dods.map((dod) => ({ ...dod, lastUpdatedUserId: userId })))
        .onConflict("id")
        .merge()
}

/** Serves `{id}.data.json` and `{id}.metadata.json` like the data API does */
function startDataApi(): Promise<http.Server> {
    const files = new Map<string, string>()
    for (const indicator of allIndicators) {
        files.set(
            `/v1/indicators/${indicator.id}.data.json`,
            JSON.stringify(indicatorData(indicator))
        )
        files.set(
            `/v1/indicators/${indicator.id}.metadata.json`,
            JSON.stringify(indicatorMetadata(indicator))
        )
    }

    const server = http.createServer((req, res) => {
        const path = new URL(req.url ?? "/", "http://localhost").pathname
        const body = files.get(path)
        res.setHeader("Access-Control-Allow-Origin", "*")
        if (body === undefined) {
            res.writeHead(404).end()
            return
        }
        res.writeHead(200, { "Content-Type": "application/json" }).end(body)
    })
    return new Promise((resolve) =>
        server.listen(DATA_API_PORT, HOST, () => resolve(server))
    )
}

/** Builds both clients, or starts a dev server for them if requested */
async function startClients(): Promise<ViteDevServer | undefined> {
    if (useViteDevServer) {
        const vite = await createServer({
            configFile: "vite.config-admin.mts",
            logLevel: "warn",
            server: {
                host: HOST,
                port: VITE_PORT,
                strictPort: true,
                // Sandboxed embeds request modules from an opaque origin.
                cors: true,
            },
        })
        await vite.listen()
        return vite
    }
    // Through the CLI, since rolldown panics when building inside tsx
    for (const [configFile, outDir] of [
        ["vite.config-admin.mts", "assets-admin"],
        ["vite.config-site.mts", "assets"],
    ]) {
        await promisify(execFile)(
            "yarn",
            [
                "vite",
                "build",
                `--config=${configFile}`,
                `--outDir=${TEST_VITE_DIST_DIR}/${outDir}`,
                "--emptyOutDir",
                "--sourcemap=false",
                "--logLevel=warn",
            ],
            { maxBuffer: 64 * 1024 * 1024 }
        )
    }
    return undefined
}

async function main(): Promise<void> {
    const database = await setupAdminTestDatabase()
    await seedFixture(database.testKnex, database.userId)

    const dataApi = await startDataApi()
    const vite = await startClients()
    const app = new OwidAdminApp({ isDev: true, isTest: true, quiet: true })
    // Match production's CORS headers for assets loaded by sandboxed embeds.
    app.app.use(["/assets", "/fonts"], (_req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*")
        next()
    })
    await app.startListening(ADMIN_SERVER_PORT, HOST)

    let isStopping = false
    const stop = async (): Promise<void> => {
        if (isStopping) return
        isStopping = true

        await resetDbButKeepBaselines(database.testKnex)
        await Promise.allSettled([
            app.stopListening(),
            vite?.close(),
            new Promise((resolve) => dataApi.close(resolve)),
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
    process.exit(1)
})
