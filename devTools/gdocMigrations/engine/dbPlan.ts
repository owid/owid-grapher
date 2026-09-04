import * as db from "../../../db/db.js"
import {
    DbRowChange,
    planGdocMigrationDb,
} from "../../../db/gdocMigrations/dbApplier.js"
import { GdocMigration } from "../types.js"
import { describeJsonDiff, diffShape, JsonDiffLine } from "./jsonDiff.js"

export interface DbPlanRunnerOptions {
    migration: GdocMigration
    /** Restrict to these posts_gdocs ids (default: every row) */
    ids?: string[]
    /** How many changed docs to print in full */
    limit: number
}

const MAX_IDS_SHOWN = 10

/**
 * Dry-runs the migration's DB side (dbTransform / frontmatter ops) against
 * the local posts_gdocs table and prints what would change, grouped by diff
 * shape like the gdoc plan report. Nothing is written. Also cross-checks the
 * changed set against the migration's discover query, since both are meant
 * to describe the same docs.
 */
export async function runDbPlan(options: DbPlanRunnerOptions): Promise<void> {
    const knex = db.knexInstance()
    const queryRunner = {
        query: (sql: string, parameters?: unknown[]) =>
            db.knexRaw(knex, sql, parameters),
    }
    console.log(
        `Planning the DB side of "${options.migration.name}"` +
            (options.ids ? ` for ${options.ids.length} doc(s)` : "") +
            "…"
    )
    const plan = await planGdocMigrationDb(queryRunner, options.migration, {
        ids: options.ids,
    })
    const changes = plan.changes.map((change) => ({
        ...change,
        diff: describeJsonDiff(change.before, change.after),
    }))

    console.log(
        `\nDB plan: scanned ${plan.scanned} posts_gdocs row(s), ${changes.length} would change`
    )

    const groups = new Map<string, { ids: string[]; shape: string[] }>()
    for (const change of changes) {
        const shape = diffShape(change.diff)
        const key = shape.join("\n")
        const group = groups.get(key) ?? { ids: [], shape }
        group.ids.push(change.id)
        groups.set(key, group)
    }
    let groupNumber = 1
    for (const group of [...groups.values()].sort(
        (a, b) => b.ids.length - a.ids.length
    )) {
        console.log(`\nGroup ${groupNumber++} — ${group.ids.length} doc(s):`)
        for (const line of group.shape) console.log(`  ${line}`)
        const shown = group.ids.slice(0, MAX_IDS_SHOWN)
        const more = group.ids.length - shown.length
        console.log(
            `  ids: ${shown.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`
        )
    }

    if (changes.length > 0) {
        const shown = changes.slice(0, options.limit)
        console.log(
            `\nDetails for ${shown.length} of ${changes.length} doc(s) (--limit <n> to show more):`
        )
        for (const change of shown) printChange(change)
    }

    if (!options.ids) await printDiscoverCrossCheck(options.migration, changes)
}

function printChange(change: DbRowChange & { diff: JsonDiffLine[] }): void {
    console.log(`\n  ${change.id}`)
    for (const line of change.diff) console.log(`    ${line.detail}`)
    for (const [column, value] of Object.entries(change.columnUpdates)) {
        console.log(`    column ${column} = ${JSON.stringify(value)}`)
    }
}

/**
 * The discover query drives the gdoc side and dbTransform drives the DB
 * side; they should agree on which docs are affected. A doc that changes
 * in the DB but isn't discovered means the gdoc run would miss it; a
 * discovered doc that doesn't change in the DB is usually fine (discover
 * only needs to be a superset) but worth a look.
 */
async function printDiscoverCrossCheck(
    migration: GdocMigration,
    changes: DbRowChange[]
): Promise<void> {
    const rows = await db.knexRaw<Record<string, unknown>>(
        db.knexInstance(),
        migration.discover
    )
    const discovered = new Set(
        rows
            .map((row) => Object.values(row)[0])
            .filter((value): value is string => typeof value === "string")
    )
    const changed = new Set(changes.map((change) => change.id))
    const changedNotDiscovered = [...changed].filter(
        (id) => !discovered.has(id)
    )
    const discoveredNotChanged = [...discovered].filter(
        (id) => !changed.has(id)
    )

    console.log(
        `\nDiscover query: ${discovered.size} doc(s); DB plan: ${changed.size} doc(s)`
    )
    if (changedNotDiscovered.length > 0) {
        console.log(
            `  ✗ ${changedNotDiscovered.length} doc(s) change in the DB but are NOT returned by discover — the gdoc run would miss them:`
        )
        console.log(`    ${changedNotDiscovered.join(", ")}`)
    }
    if (discoveredNotChanged.length > 0) {
        console.log(
            `  · ${discoveredNotChanged.length} discovered doc(s) don't change in the DB (fine if discover is a deliberate superset):`
        )
        const shown = discoveredNotChanged.slice(0, MAX_IDS_SHOWN)
        const more = discoveredNotChanged.length - shown.length
        console.log(
            `    ${shown.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`
        )
    }
    if (changedNotDiscovered.length === 0 && discoveredNotChanged.length === 0)
        console.log("  ✓ discover and the DB plan agree exactly")
}
