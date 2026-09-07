import {
    knexRaw,
    knexReadonlyTransaction,
    TransactionCloseMode,
    type KnexReadonlyTransaction,
} from "../../db/db.js"
import {
    type GrapherConfigValidationIssue,
    GrapherConfigValidationError,
    ingestGrapherConfig,
} from "../../db/grapherConfigValidation.js"
import {
    GRAPHER_DB_HOST,
    GRAPHER_DB_NAME,
    GRAPHER_DB_PORT,
} from "../../settings/serverSettings.js"
import { parseChartConfig } from "../../db/model/ChartConfigs.js"
export type ConfigOwner = "chart" | "indicator" | "narrativeChart" | "multiDim"
type ConfigRole = "patch" | "full"

export type OwnerRef =
    | { owner: "chart"; id: string }
    | { owner: "indicator"; id: string }
    | { owner: "narrativeChart"; id: string }
    | { owner: "multiDim"; id: string; viewId: string }

export type ConfigReference =
    | {
          owner: "chart" | "indicator" | "narrativeChart"
          role: ConfigRole
          ownerIdColumn: string
      }
    | {
          owner: "multiDim"
          role: ConfigRole
          ownerIdColumn: string
          ownerViewIdColumn: string
      }

/**
 * All database columns referencing `chart_configs`, mapped to their owner and
 * validation role, or `null` if ignored
 */
export const REFERENCING_COLUMNS: Record<string, ConfigReference | null> = {
    "charts.configId": {
        owner: "chart",
        role: "full",
        ownerIdColumn: "id",
    },
    "charts.patchConfigId": {
        owner: "chart",
        role: "patch",
        ownerIdColumn: "id",
    },
    "charts.patchConfigIdETL": {
        owner: "chart",
        role: "patch",
        ownerIdColumn: "id",
    },
    "multi_dim_x_chart_configs.chartConfigId": {
        owner: "multiDim",
        role: "full",
        ownerIdColumn: "multiDimId",
        ownerViewIdColumn: "viewId",
    },
    "narrative_charts.chartConfigId": {
        owner: "narrativeChart",
        role: "full",
        ownerIdColumn: "id",
    },
    "narrative_charts.patchConfigId": {
        owner: "narrativeChart",
        role: "patch",
        ownerIdColumn: "id",
    },
    "variables.patchConfigIdETL": {
        owner: "indicator",
        role: "patch",
        ownerIdColumn: "id",
    },

    // Not validated
    "explorer_views.chartConfigId": null,
    "multi_dim_redirects.viewConfigId": null,
}

const BATCH_SIZE = 2000
const MAX_LISTED_IDS = 20

interface ValidationIssueGroup {
    owner: ConfigOwner
    role: ConfigRole
    pointer: string
    message: string
    count: number
    exampleIds: string[]
}

export interface RawReferenceRow {
    id: string
    reference: string
    ownerId: string | null
    ownerViewId: string | null
}

interface IndexedReference {
    column: string
    reference: ConfigReference | null
    owner: OwnerRef | null
}

interface ReferenceConflict {
    id: string
    references: [string, string]
}

interface UnexpectedFailure {
    id: string
    message: string
}

interface Report {
    ownerRoleCounts: Map<string, number>
    notValidatedCounts: Map<string, number>
    validationIssues: Map<string, ValidationIssueGroup>
    conflicts: ReferenceConflict[]
    unreferencedIds: string[]
    unexpectedFailures: UnexpectedFailure[]
}

async function assertReferencingColumnsUpToDate(
    trx: KnexReadonlyTransaction
): Promise<void> {
    const rows = await knexRaw<{ tableName: string; columnName: string }>(
        trx,
        `-- sql
        SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND REFERENCED_TABLE_NAME = 'chart_configs'
        `
    )
    const actualColumns = new Set(
        rows.map((row) => `${row.tableName}.${row.columnName}`)
    )
    const knownColumns = new Set(Object.keys(REFERENCING_COLUMNS))

    const missing = [...actualColumns].filter(
        (column) => !knownColumns.has(column)
    )
    const stale = [...knownColumns].filter(
        (column) => !actualColumns.has(column)
    )
    if (missing.length === 0 && stale.length === 0) return

    const lines = [
        "REFERENCING_COLUMNS in checkChartConfigsAgainstSchema.ts no longer matches the database schema.",
    ]
    if (missing.length > 0)
        lines.push(
            `Add these columns to REFERENCING_COLUMNS, with their owner and role or null: ${missing.join(", ")}`
        )
    if (stale.length > 0)
        lines.push(
            `Remove these columns from REFERENCING_COLUMNS, they no longer reference chart_configs: ${stale.join(", ")}`
        )
    throw new Error(lines.join("\n"))
}

export function buildReferenceIndexQuery(): string {
    return Object.entries(REFERENCING_COLUMNS)
        .map(([columnKey, reference]) => {
            const [table, column] = columnKey.split(".")
            const ownerId = buildOwnerIdentityExpression(
                table,
                reference?.ownerIdColumn ?? null
            )
            const ownerViewId = buildOwnerIdentityExpression(
                table,
                reference?.owner === "multiDim"
                    ? reference.ownerViewIdColumn
                    : null
            )
            return `SELECT \`${column}\` AS id, '${columnKey}' AS reference, ${ownerId} AS ownerId, ${ownerViewId} AS ownerViewId FROM \`${table}\` WHERE \`${column}\` IS NOT NULL`
        })
        .join("\nUNION ALL\n")
}

function buildOwnerIdentityExpression(
    table: string,
    column: string | null
): string {
    if (column === null) return "NULL"
    return `CAST(\`${table}\`.\`${column}\` AS CHAR)`
}

export function parseOwnerRef(
    owner: ConfigOwner,
    row: RawReferenceRow
): OwnerRef {
    if (row.ownerId === null)
        throw new Error(`chart_configs row ${row.id} has no owner id`)
    switch (owner) {
        case "multiDim":
            if (row.ownerViewId === null)
                throw new Error(
                    `chart_configs row ${row.id} is a multiDim owner with no view id`
                )
            return { owner, id: row.ownerId, viewId: row.ownerViewId }
        case "chart":
        case "indicator":
        case "narrativeChart":
            return { owner, id: row.ownerId }
    }
}

export function buildReferenceIndex(rows: RawReferenceRow[]): {
    index: Map<string, IndexedReference>
    conflicts: ReferenceConflict[]
} {
    const index = new Map<string, IndexedReference>()
    const conflicts: ReferenceConflict[] = []

    for (const row of rows) {
        const reference = REFERENCING_COLUMNS[row.reference]
        const owner =
            reference === null ? null : parseOwnerRef(reference.owner, row)
        const indexed: IndexedReference = {
            column: row.reference,
            reference,
            owner,
        }
        const existing = index.get(row.id)
        if (existing === undefined) {
            index.set(row.id, indexed)
            continue
        }
        if (existing.reference === null) {
            if (reference !== null) index.set(row.id, indexed)
            continue
        }
        if (reference === null) continue
        if (
            existing.reference.owner !== reference.owner ||
            existing.reference.role !== reference.role
        )
            conflicts.push({
                id: row.id,
                references: [existing.column, row.reference],
            })
    }

    return { index, conflicts }
}

function createReport(): Report {
    return {
        ownerRoleCounts: new Map(),
        notValidatedCounts: new Map(),
        validationIssues: new Map(),
        conflicts: [],
        unreferencedIds: [],
        unexpectedFailures: [],
    }
}

function increment(counts: Map<string, number>, key: string): void {
    counts.set(key, (counts.get(key) ?? 0) + 1)
}

function recordValidationIssue(
    report: Report,
    owner: ConfigOwner,
    role: ConfigRole,
    issue: GrapherConfigValidationIssue,
    configId: string
): void {
    const key = `${owner}|${role}|${issue.pointer}|${issue.message}`
    const existing = report.validationIssues.get(key)
    if (existing) {
        existing.count++
        if (existing.exampleIds.length < 3) existing.exampleIds.push(configId)
        return
    }
    report.validationIssues.set(key, {
        owner,
        role,
        pointer: issue.pointer,
        message: issue.message,
        count: 1,
        exampleIds: [configId],
    })
}

function processRow(
    report: Report,
    referenceIndex: Map<string, IndexedReference>,
    row: { id: string; config: string }
): void {
    const indexed = referenceIndex.get(row.id)
    if (indexed === undefined) {
        report.unreferencedIds.push(row.id)
        return
    }

    if (indexed.reference === null) {
        increment(report.notValidatedCounts, indexed.column)
        return
    }

    const { owner, role } = indexed.reference
    increment(report.ownerRoleCounts, `${owner}/${role}`)

    // The report validates the stored version, not a migrated config
    const config = parseChartConfig(row.config, { skipMigration: true })
    try {
        ingestGrapherConfig(config)
    } catch (error) {
        if (error instanceof GrapherConfigValidationError) {
            for (const issue of error.issues)
                recordValidationIssue(report, owner, role, issue, row.id)
        } else
            report.unexpectedFailures.push({
                id: row.id,
                message: error instanceof Error ? error.message : String(error),
            })
    }
}

async function walkChartConfigs(
    trx: KnexReadonlyTransaction,
    referenceIndex: Map<string, IndexedReference>,
    report: Report
): Promise<void> {
    let lastId = ""
    while (true) {
        const rows = await knexRaw<{ id: string; config: string }>(
            trx,
            "SELECT `id`, `config` FROM `chart_configs` WHERE `id` > ? ORDER BY `id` LIMIT ?",
            [lastId, BATCH_SIZE]
        )
        if (rows.length === 0) break
        for (const row of rows) processRow(report, referenceIndex, row)
        lastId = rows[rows.length - 1].id
    }
}

function orderedOwnerRoles(): ConfigReference[] {
    const seen = new Set<string>()
    const ordered: ConfigReference[] = []
    for (const reference of Object.values(REFERENCING_COLUMNS)) {
        if (reference === null) continue
        const key = `${reference.owner}/${reference.role}`
        if (seen.has(key)) continue
        seen.add(key)
        ordered.push(reference)
    }
    return ordered
}

function printOwnerRoleCounts(counts: Map<string, number>): void {
    const pairs = orderedOwnerRoles().map((reference) => ({
        ...reference,
        label: `${reference.owner}/${reference.role}`,
    }))
    const width = Math.max(...pairs.map(({ label }) => label.length))
    for (const { label } of pairs)
        console.log(`  ${label.padEnd(width)}  ${counts.get(label) ?? 0}`)
}

function printNotValidatedCounts(counts: Map<string, number>): void {
    const columns = Object.entries(REFERENCING_COLUMNS)
        .filter(([, reference]) => reference === null)
        .map(([column]) => column)
    const width = Math.max(...columns.map((column) => column.length))
    for (const column of columns)
        console.log(`  ${column.padEnd(width)}  ${counts.get(column) ?? 0}`)
}

function printValidationIssues(
    issues: Map<string, ValidationIssueGroup>
): void {
    if (issues.size === 0) {
        console.log("  none")
        return
    }
    const sorted = [...issues.values()].sort((a, b) => b.count - a.count)
    for (const issue of sorted)
        console.log(
            `  ${issue.owner}/${issue.role} ${issue.pointer || "(root)"}: ${issue.message} (${issue.count}, e.g. ${issue.exampleIds.join(", ")})`
        )
}

function printConflicts(conflicts: ReferenceConflict[]): void {
    if (conflicts.length === 0) {
        console.log("  none")
        return
    }
    for (const conflict of conflicts)
        console.log(
            `  ${conflict.id}: ${conflict.references[0]} vs ${conflict.references[1]}`
        )
}

function printUnreferencedIds(ids: string[]): void {
    if (ids.length === 0) {
        console.log("  none")
        return
    }
    console.log(`  ${ids.length} rows`)
    for (const id of ids.slice(0, MAX_LISTED_IDS)) console.log(`  ${id}`)
    if (ids.length > MAX_LISTED_IDS)
        console.log(`  ... and ${ids.length - MAX_LISTED_IDS} more`)
}

function printUnexpectedFailures(failures: UnexpectedFailure[]): void {
    if (failures.length === 0) {
        console.log("  none")
        return
    }
    for (const failure of failures)
        console.log(`  ${failure.id}: ${failure.message}`)
}

function printReport(report: Report, elapsedSeconds: number): void {
    const counted = [...report.ownerRoleCounts.values()].reduce(
        (total, count) => total + count,
        0
    )
    const skipped = [...report.notValidatedCounts.values()].reduce(
        (total, count) => total + count,
        0
    )

    console.log("Validated stored grapher configs")
    console.log(
        `Database: ${GRAPHER_DB_HOST}:${GRAPHER_DB_PORT}/${GRAPHER_DB_NAME}`
    )
    console.log(`Rows: ${counted + skipped + report.unreferencedIds.length}`)
    console.log(`Date: ${new Date().toISOString()}`)
    console.log("")

    console.log("Validated, by owner and role:")
    printOwnerRoleCounts(report.ownerRoleCounts)
    console.log("")

    console.log("Not validated, by the column that names them:")
    printNotValidatedCounts(report.notValidatedCounts)
    console.log("")

    console.log("Validation issues:")
    printValidationIssues(report.validationIssues)
    console.log("")

    console.log("Rows referenced with conflicting roles:")
    printConflicts(report.conflicts)
    console.log("")

    console.log("Rows nothing references:")
    printUnreferencedIds(report.unreferencedIds)
    console.log("")

    console.log("Rows that threw an unexpected error:")
    printUnexpectedFailures(report.unexpectedFailures)
    console.log("")

    console.log(
        `Validated ${counted}, skipped ${skipped}, elapsed ${elapsedSeconds.toFixed(1)}s`
    )
}

async function main(): Promise<void> {
    const startTime = Date.now()

    await knexReadonlyTransaction(async (trx) => {
        await assertReferencingColumnsUpToDate(trx)

        const referenceRows = await knexRaw<RawReferenceRow>(
            trx,
            buildReferenceIndexQuery()
        )
        const { index: referenceIndex, conflicts } =
            buildReferenceIndex(referenceRows)

        const report = createReport()
        report.conflicts = conflicts
        await walkChartConfigs(trx, referenceIndex, report)

        printReport(report, (Date.now() - startTime) / 1000)
    }, TransactionCloseMode.Close)
}

main()
    .catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
    .finally(() => {
        process.exit()
    })
