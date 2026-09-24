import parseArgs from "minimist"
import * as _ from "lodash-es"
import { GdocChartPreviewRefreshResult } from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { refreshGdocChartPreviews } from "../../db/model/Gdoc/chartPreviews/refreshGdocChartPreviews.js"
import { getGdocIdsWithChangedCharts } from "../../db/model/Gdoc/chartPreviews/gdocsWithChangedCharts.js"

function printHelp(): void {
    console.log(`Update the chart preview images above chart components in gdocs.

Replaces images that don't show the current version of their chart. Meant to
run on a schedule with --changed-since-hours, or by hand for specific docs.

Usage:
    yarn refreshGdocChartPreviews [options] [gdocId...]

Options:
    --changed-since-hours <n>  Refresh all gdocs linking to charts whose config
                               or data changed in the last <n> hours.
    --insert-missing           Also add images above components that have none.
    --dry-run                  Only report what would change.
    -h, --help                 Show this message.
`)
}

function printResult(result: GdocChartPreviewRefreshResult): void {
    const counts = _.countBy(result.items, (item) => item.status)
    console.log(
        `${result.gdocId}: ${
            Object.entries(counts)
                .map(([status, count]) => `${count} ${status}`)
                .join(", ") || "no chart components"
        }`
    )
    for (const item of result.items) {
        if (item.status === "upToDate") continue
        const message = item.message ? ` — ${item.message}` : ""
        console.log(
            `  [${item.status}] ${item.tabTitle}: ${item.componentType} ${item.target}${message}`
        )
    }
}

async function main(args: parseArgs.ParsedArgs): Promise<void> {
    const gdocIds: string[] = args._.map(String)
    if (args["changed-since-hours"] !== undefined) {
        const hours = Number(args["changed-since-hours"])
        if (!Number.isFinite(hours)) throw new Error("Invalid number of hours")
        const since = new Date(Date.now() - hours * 60 * 60 * 1000)
        const changed = await db.knexReadonlyTransaction((knex) =>
            getGdocIdsWithChangedCharts(knex, since)
        )
        console.log(
            `${changed.length} gdocs link to charts changed since ${since.toISOString()}`
        )
        gdocIds.push(...changed)
    }

    let hasFailures = false
    for (const gdocId of _.uniq(gdocIds)) {
        try {
            // Each doc gets its own transaction so we don't hold one open
            // across all the Google API calls
            const result = await db.knexReadonlyTransaction((knex) =>
                refreshGdocChartPreviews(knex, gdocId, {
                    insertMissing: !!args["insert-missing"],
                    dryRun: !!args["dry-run"],
                })
            )
            printResult(result)
            if (result.items.some((item) => item.status === "failed"))
                hasFailures = true
        } catch (error) {
            hasFailures = true
            console.error(`${gdocId}: failed —`, error)
        }
    }
    if (hasFailures) process.exitCode = 1
}

const args = parseArgs(process.argv.slice(2), {
    boolean: ["insert-missing", "dry-run", "help"],
    alias: { h: "help" },
})

if (
    args.help ||
    (args._.length === 0 && args["changed-since-hours"] === undefined)
) {
    printHelp()
} else {
    main(args)
        .catch((error) => {
            console.error(error)
            process.exitCode = 1
        })
        .finally(() => db.closeTypeOrmAndKnexConnections())
}
