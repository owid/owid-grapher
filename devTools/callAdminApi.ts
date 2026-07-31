// Small CLI for calling any owid-grapher admin API (local dev, staging, or
// production) from the command line, e.g. for manually testing a chart
// config change on a staging server without going through the browser.
//
// Auth: reads ADMIN_API_KEY from .env. The same key works against every
// staging server, since `admin_api_keys` ships in the private data dump that
// every staging build restores from (see db/exportMetadataTables.ts).
//
// Examples:
//   yarn tsx devTools/callAdminApi.ts get 123 --branch archiving-charts
//   yarn tsx devTools/callAdminApi.ts set 123 '{"deprecationNotice":"test"}' --branch archiving-charts
//   yarn tsx devTools/callAdminApi.ts get 123 --host http://localhost:3030/admin/api
//
// set/unset attribute writes to the ADMIN_API_KEY's own owner (e.g. the etl
// service account) unless you pass --userId <id>, which requires that owner
// to be a superuser.

import "../settings/loadDotenv.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { getContainerName } from "./stagingHostname.js"

interface HostArgs {
    branch?: string
    host?: string
}

function resolveBaseUrl(args: HostArgs): string {
    if (args.host) return args.host.replace(/\/$/, "")
    if (args.branch)
        return `http://${getContainerName(args.branch)}.tail6e23.ts.net/admin/api`
    return "http://localhost:3030/admin/api"
}

function getApiKey(): string {
    const key = process.env.ADMIN_API_KEY
    if (!key)
        throw new Error(
            "ADMIN_API_KEY is not set. Add it to .env (see devTools/createAdminApiKey.ts to mint one, " +
                "or reuse the shared key already used by etl)."
        )
    return key
}

async function getChartConfig(
    baseUrl: string,
    chartId: number
): Promise<Record<string, unknown>> {
    const res = await fetch(`${baseUrl}/charts/${chartId}.config.json`, {
        headers: { Authorization: `Bearer ${getApiKey()}` },
    })
    if (!res.ok)
        throw new Error(`GET failed: ${res.status} ${await res.text()}`)
    return res.json()
}

async function putChartConfig(
    baseUrl: string,
    chartId: number,
    config: Record<string, unknown>,
    userId: number | undefined
): Promise<void> {
    const res = await fetch(`${baseUrl}/charts/${chartId}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${getApiKey()}`,
            "Content-Type": "application/json",
            ...(userId !== undefined && { "x-act-as-user": String(userId) }),
        },
        body: JSON.stringify(config),
    })
    // Read as text before parsing: error responses (e.g. a 502 from a proxy)
    // aren't always JSON, and the raw body is the best error message we have.
    const body = await res.text()
    if (!res.ok) throw new Error(`PUT failed: ${res.status} ${body}`)
    const json = JSON.parse(body) as { success?: boolean }
    if (json.success === false) throw new Error(`PUT failed: ${body}`)
}

async function main() {
    await yargs(hideBin(process.argv))
        // Fail fast with a clean message instead of a stack trace buried
        // under yargs' usage output, which is what a lazy check inside a
        // command handler would otherwise produce. As middleware it doesn't
        // run for --help, so usage stays viewable without a key.
        .middleware(() => void getApiKey())
        .option("branch", {
            type: "string",
            describe:
                "Staging branch name, e.g. archiving-charts (resolves to staging-site-<branch>)",
        })
        .option("host", {
            type: "string",
            describe:
                "Override base URL, e.g. http://localhost:3030/admin/api. Takes precedence over --branch.",
        })
        .option("userId", {
            type: "number",
            describe:
                "Attribute set/unset writes to this user id instead of ADMIN_API_KEY's own owner " +
                "(sends x-act-as-user; the key's user must be a superuser).",
        })
        .command(
            "get <chartId>",
            "Fetch a chart's full config as JSON",
            (y) =>
                y.positional("chartId", {
                    type: "number",
                    demandOption: true,
                }),
            async (argv) => {
                const baseUrl = resolveBaseUrl(argv)
                const config = await getChartConfig(baseUrl, argv.chartId)
                console.log(JSON.stringify(config, null, 2))
            }
        )
        .command(
            "set <chartId> <patchJson>",
            "Shallow-merge a JSON object into a chart's config and save it",
            (y) =>
                y
                    .positional("chartId", {
                        type: "number",
                        demandOption: true,
                    })
                    .positional("patchJson", {
                        type: "string",
                        demandOption: true,
                        describe: "JSON object to merge into the config",
                    }),
            async (argv) => {
                const baseUrl = resolveBaseUrl(argv)
                const { chartId } = argv
                const patch = JSON.parse(argv.patchJson)
                const current = await getChartConfig(baseUrl, chartId)
                const merged = { ...current, ...patch }
                await putChartConfig(baseUrl, chartId, merged, argv.userId)
                console.log("Saved. New config:")
                console.log(JSON.stringify(merged, null, 2))
            }
        )
        .command(
            "unset <chartId> <field>",
            "Remove a top-level field from a chart's config and save it",
            (y) =>
                y
                    .positional("chartId", {
                        type: "number",
                        demandOption: true,
                    })
                    .positional("field", {
                        type: "string",
                        demandOption: true,
                        describe: "Top-level config key to remove",
                    }),
            async (argv) => {
                const baseUrl = resolveBaseUrl(argv)
                const { chartId } = argv
                const current = await getChartConfig(baseUrl, chartId)
                delete current[argv.field]
                await putChartConfig(baseUrl, chartId, current, argv.userId)
                console.log("Saved. New config:")
                console.log(JSON.stringify(current, null, 2))
            }
        )
        .demandCommand(1)
        .strict()
        .help().argv
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(-1)
})
