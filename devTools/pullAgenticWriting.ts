// Pulls every agentic-writing lineage and its full version history out of an
// admin API into a local JSON file.
//
// Why this exists: the agentic_writing_* tables are SCHEMA_ONLY_TABLES (see
// db/exportMetadataTables.ts), so their rows travel in no dump — public or
// private. A staging server is destroyed after two weeks of inactivity, and
// everything reviewed on it goes with it. Run this after a review session so
// the decisions, revisions and reviewer edits survive the server.
//
// The output is also what /retrospective wants to read: a complete review
// history it can analyse without a live database.
//
// Examples:
//   yarn tsx devTools/pullAgenticWriting.ts --branch data-nuggets
//   yarn tsx devTools/pullAgenticWriting.ts --host http://localhost:3030/admin/api
//   yarn tsx devTools/pullAgenticWriting.ts --branch data-nuggets --out /tmp/snap.json

import "../settings/loadDotenv.js"
import * as fs from "fs/promises"
import * as path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { getContainerName } from "./stagingHostname.js"

interface HostArgs {
    branch?: string
    host?: string
}

// Mirrors devTools/callAdminApi.ts so both tools address hosts identically.
function resolveBaseUrl(args: HostArgs): string {
    if (args.host) return args.host.replace(/\/$/, "")
    if (args.branch)
        return `http://${getContainerName(args.branch)}.tail6e23.ts.net/admin/api`
    return "http://localhost:3030/admin/api"
}

// The admin API key is optional here: this tool only reads, and a staging
// admin API reached over Tailscale answers unauthenticated. Send the header
// when we have a key so the same command also works against hosts that do
// require auth.
function authHeaders(): Record<string, string> {
    const key = process.env.ADMIN_API_KEY ?? process.env.OWID_ADMIN_API_KEY
    return key ? { Authorization: `Bearer ${key}` } : {}
}

async function getJson<T>(url: string): Promise<T> {
    let res: Response
    try {
        res = await fetch(url, { headers: authHeaders() })
    } catch (error) {
        // Node's bare "fetch failed" doesn't say which host, and the usual
        // cause here is a staging server that no longer exists — so name it.
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(`Could not reach ${url}: ${reason}`, { cause: error })
    }
    // Read as text first: an error from a proxy in front of the admin isn't
    // necessarily JSON, and the raw body is the most useful message we have.
    const body = await res.text()
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${body}`)
    return JSON.parse(body) as T
}

interface ListItem {
    lineageKey: string
}

interface ListResponse {
    totalReturned: number
    items: ListItem[]
}

async function main(): Promise<void> {
    const argv = await yargs(hideBin(process.argv))
        .option("branch", {
            type: "string",
            describe:
                "Staging branch name, e.g. data-nuggets (resolves to staging-site-<branch>)",
        })
        .option("host", {
            type: "string",
            describe:
                "Override base URL, e.g. http://localhost:3030/admin/api. Takes precedence over --branch.",
        })
        .option("out", {
            type: "string",
            describe:
                "Output path. Defaults to data-nuggets/reviews/pull-<timestamp>.json",
        })
        .strict()
        .help().argv

    const baseUrl = resolveBaseUrl(argv)
    const list = await getJson<ListResponse>(`${baseUrl}/agentic-writing.json`)
    console.log(`${list.items.length} lineages at ${baseUrl}`)

    // Sequential on purpose: this is a handful of hundreds of rows at most,
    // and a staging box is not worth hammering with parallel requests.
    const lineages: unknown[] = []
    let versionCount = 0
    for (const [i, item] of list.items.entries()) {
        const history = await getJson<{ versions?: unknown[] }>(
            `${baseUrl}/agentic-writing/${encodeURIComponent(item.lineageKey)}`
        )
        versionCount += history.versions?.length ?? 0
        lineages.push(history)
        if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${list.items.length}`)
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const outPath =
        argv.out ??
        path.join("data-nuggets", "reviews", `pull-${timestamp}.json`)
    await fs.mkdir(path.dirname(outPath), { recursive: true })
    await fs.writeFile(
        outPath,
        JSON.stringify(
            {
                pulledAt: new Date().toISOString(),
                source: baseUrl,
                lineageCount: lineages.length,
                versionCount,
                lineages,
            },
            null,
            2
        )
    )
    console.log(
        `Wrote ${lineages.length} lineages / ${versionCount} versions to ${outPath}`
    )
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(-1)
})
