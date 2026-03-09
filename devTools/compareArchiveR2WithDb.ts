/**
 * Compares files in the R2 `owid-archive` bucket with entries in the
 * `archived_chart_versions` and `archived_multi_dim_versions` database tables.
 * This is useful to check for any discrepancies between the two sources, such as missing files in R2 that may have happened because of a failed R2 upload.
 *
 * Uses `rclone lsf` to stream all files, then queries the database for all
 * archived chart and multi-dim versions and reports:
 *   - Files in R2 that have no matching database entry
 *   - Database entries that have no matching R2 file
 *
 * NOTE that this only looks at charts and mdims, not at posts or other archived content.
 *
 * Usage:
 *   yarn compareArchiveR2WithDb
 */

import { spawn } from "child_process"
import { createInterface } from "readline"
import * as db from "../db/db.js"
import { DbPlainArchivedChartVersion } from "@ourworldindata/types"
import { convertToArchivalDateStringIfNecessary } from "@ourworldindata/utils"

/**
 * Lists all files in r2:owid-archive by streaming rclone lsf output
 * line-by-line, reporting progress every 1000 files.
 */
const listR2Files = async (): Promise<Set<string>> => {
    console.log("Listing files in r2:owid-archive (this may take a while)...")

    const paths = new Set<string>()

    await new Promise<void>((resolve, reject) => {
        const proc = spawn("rclone", [
            "lsf",
            "r2:owid-archive",
            "--recursive",
            "--files-only",
            "--exclude",
            "assets/**",
        ])

        const rl = createInterface({ input: proc.stdout })

        rl.on("line", (line) => {
            const trimmed = line.trim()
            if (trimmed) {
                paths.add(trimmed)
                if (paths.size % 1000 === 0) {
                    process.stderr.write(`  ${paths.size} files found...\r`)
                }
            }
        })

        let stderr = ""
        proc.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString()
        })

        proc.on("close", (code) => {
            // Clear the progress line
            process.stderr.write("\r\x1b[K")
            if (code !== 0) {
                reject(new Error(`rclone exited with code ${code}: ${stderr}`))
            } else {
                resolve()
            }
        })

        proc.on("error", reject)
    })

    console.log(`Found ${paths.size} files in R2.`)
    return paths
}

/**
 * Queries the database for all archived chart and multi-dim versions and
 * returns the expected R2 paths as a Set. Both types share the same
 * /{date}/grapher/{slug}.html path namespace.
 */
const listDbExpectedPaths = async (): Promise<Set<string>> => {
    console.log(
        "Querying archived_chart_versions and archived_multi_dim_versions from database..."
    )

    return await db.knexReadonlyTransaction(async (trx) => {
        const chartRows = await db.knexRaw<
            Pick<
                DbPlainArchivedChartVersion,
                "grapherSlug" | "archivalTimestamp"
            >
        >(
            trx,
            `SELECT grapherSlug, archivalTimestamp FROM archived_chart_versions`
        )

        const multiDimRows = await db.knexRaw<{
            multiDimSlug: string
            archivalTimestamp: Date
        }>(
            trx,
            `SELECT multiDimSlug, archivalTimestamp FROM archived_multi_dim_versions`
        )

        const paths = new Set<string>()
        for (const row of chartRows) {
            const dateStr = convertToArchivalDateStringIfNecessary(
                row.archivalTimestamp
            )
            paths.add(`${dateStr}/grapher/${row.grapherSlug}.html`)
        }
        for (const row of multiDimRows) {
            const dateStr = convertToArchivalDateStringIfNecessary(
                row.archivalTimestamp
            )
            paths.add(`${dateStr}/grapher/${row.multiDimSlug}.html`)
        }

        console.log(
            `Found ${chartRows.length} chart rows and ${multiDimRows.length} multi-dim rows in DB, mapping to ${paths.size} unique expected paths.`
        )
        return paths
    }, db.TransactionCloseMode.Close)
}

const main = async (): Promise<void> => {
    const [r2Files, dbPaths] = await Promise.all([
        listR2Files(),
        listDbExpectedPaths(),
    ])

    // Only consider grapher HTML files in R2 for the comparison, since other
    // files (assets, data, etc.) are shared and not tracked per-chart.
    const r2GrapherHtmlFiles = new Set<string>()
    for (const path of r2Files) {
        if (path.match(/^\d{8}-\d{6}\/grapher\/.*\.html$/)) {
            r2GrapherHtmlFiles.add(path)
        }
    }

    console.log(
        `\nOf the ${r2Files.size} R2 files, ${r2GrapherHtmlFiles.size} are grapher HTML files.`
    )

    // Files in R2 but not in DB
    const inR2NotInDb: string[] = []
    for (const path of r2GrapherHtmlFiles) {
        if (!dbPaths.has(path)) {
            inR2NotInDb.push(path)
        }
    }

    // DB entries with no corresponding R2 file
    const inDbNotInR2: string[] = []
    for (const path of dbPaths) {
        if (!r2GrapherHtmlFiles.has(path)) {
            inDbNotInR2.push(path)
        }
    }

    // Report results
    console.log("\n=== Comparison Results ===")
    console.log(`Grapher HTML files in R2: ${r2GrapherHtmlFiles.size}`)
    console.log(`Expected paths from DB: ${dbPaths.size}`)
    console.log(`In R2 but not in DB: ${inR2NotInDb.length}`)
    console.log(`In DB but not in R2: ${inDbNotInR2.length}`)

    if (inR2NotInDb.length > 0) {
        console.log(`\n--- In R2 but not in DB (${inR2NotInDb.length}) ---`)
        for (const path of inR2NotInDb.sort()) {
            console.log(`  ${path}`)
        }
    }

    if (inDbNotInR2.length > 0) {
        console.log(`\n--- In DB but not in R2 (${inDbNotInR2.length}) ---`)
        for (const path of inDbNotInR2.sort()) {
            console.log(`  ${path}`)
        }
    }

    if (inR2NotInDb.length === 0 && inDbNotInR2.length === 0) {
        console.log("\nAll grapher HTML files in R2 match the database.")
    }
}

void main().then(() => process.exit())
