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
    ADMIN_BASE_URL,
    GRAPHER_DB_HOST,
    GRAPHER_DB_NAME,
    GRAPHER_DB_PORT,
} from "../../settings/serverSettings.js"
import { parseChartConfig } from "../../db/model/ChartConfigs.js"
type ConfigOwner = "chart" | "indicator" | "narrativeChart" | "multiDim"
type ConfigRole = "patch" | "full"

type OwnerRef =
    | { owner: "chart"; id: string }
    | { owner: "indicator"; id: string }
    | { owner: "narrativeChart"; id: string }
    | { owner: "multiDim"; id: string; viewId: string }

type ConfigReference =
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
const REFERENCING_COLUMNS: Record<string, ConfigReference | null> = {
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
    column: string
    pointer: string
    message: string
    count: number
    exampleOwners: OwnerRef[]
}

interface RawReferenceRow {
    id: string
    reference: string
    ownerId: string | null
    ownerViewId: string | null
}

interface IndexedReference {
    column: string
    validated: { reference: ConfigReference; owner: OwnerRef } | null
}

interface ReferenceConflict {
    id: string
    references: [string, string]
}

interface UnexpectedFailure {
    owner: OwnerRef
    message: string
}

interface Report {
    validatedCounts: Map<string, number>
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

function buildReferenceIndexQuery(): string {
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

function parseOwnerRef(owner: ConfigOwner, row: RawReferenceRow): OwnerRef {
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

function adminUrlForOwner(owner: OwnerRef): string {
    switch (owner.owner) {
        case "chart":
            return `${ADMIN_BASE_URL}/admin/charts/${owner.id}/edit`
        case "narrativeChart":
            return `${ADMIN_BASE_URL}/admin/narrative-charts/${owner.id}/edit`
        case "multiDim":
            return `${ADMIN_BASE_URL}/admin/multi-dims/${owner.id}`
        case "indicator":
            return `${ADMIN_BASE_URL}/admin/variables/${owner.id}`
    }
}

function formatOwnerRef(owner: OwnerRef): string {
    const url = adminUrlForOwner(owner)
    return owner.owner === "multiDim" ? `${url} (view ${owner.viewId})` : url
}

function buildReferenceIndex(rows: RawReferenceRow[]): {
    index: Map<string, IndexedReference>
    conflicts: ReferenceConflict[]
} {
    const index = new Map<string, IndexedReference>()
    const conflicts: ReferenceConflict[] = []

    for (const row of rows) {
        const reference = REFERENCING_COLUMNS[row.reference]
        const indexed: IndexedReference = {
            column: row.reference,
            validated:
                reference === null
                    ? null
                    : { reference, owner: parseOwnerRef(reference.owner, row) },
        }
        const existing = index.get(row.id)
        if (existing === undefined) {
            index.set(row.id, indexed)
            continue
        }
        if (existing.validated === null) {
            if (reference !== null) index.set(row.id, indexed)
            continue
        }
        if (reference === null) continue
        if (
            existing.validated.reference.owner !== reference.owner ||
            existing.validated.reference.role !== reference.role
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
        validatedCounts: new Map(),
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
    column: string,
    owner: OwnerRef,
    issue: GrapherConfigValidationIssue
): void {
    const key = `${column}|${issue.pointer}|${issue.message}`
    const existing = report.validationIssues.get(key)
    if (existing) {
        existing.count++
        if (existing.exampleOwners.length < 3)
            existing.exampleOwners.push(owner)
        return
    }
    report.validationIssues.set(key, {
        column,
        pointer: issue.pointer,
        message: issue.message,
        count: 1,
        exampleOwners: [owner],
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

    if (indexed.validated === null) {
        increment(report.notValidatedCounts, indexed.column)
        return
    }

    const { owner } = indexed.validated
    increment(report.validatedCounts, indexed.column)

    const config = parseChartConfig(row.config, { skipMigration: true })
    try {
        ingestGrapherConfig(config)
    } catch (error) {
        if (error instanceof GrapherConfigValidationError) {
            for (const issue of error.issues)
                recordValidationIssue(report, indexed.column, owner, issue)
        } else
            report.unexpectedFailures.push({
                owner,
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

function printColumnCounts(
    columns: string[],
    counts: Map<string, number>
): void {
    const width = Math.max(...columns.map((column) => column.length))
    for (const column of columns)
        console.log(`  ${column.padEnd(width)}  ${counts.get(column) ?? 0}`)
}

function partitionReferencingColumns(): {
    validated: string[]
    notValidated: string[]
} {
    const validated: string[] = []
    const notValidated: string[] = []
    for (const [column, reference] of Object.entries(REFERENCING_COLUMNS)) {
        if (reference === null) notValidated.push(column)
        else validated.push(column)
    }
    return { validated, notValidated }
}

function renderValidationIssues(
    issues: Map<string, ValidationIssueGroup>,
    validatedCounts: Map<string, number>
): string[] {
    if (issues.size === 0) return ["  none"]
    const sorted = [...issues.values()].sort((a, b) => b.count - a.count)
    return sorted.map((issue) => {
        const total = validatedCounts.get(issue.column) ?? 0
        return `  ${issue.column} ${issue.pointer || "(root)"}: ${issue.message} (${issue.count} of ${total}, e.g. ${issue.exampleOwners.map(formatOwnerRef).join(", ")})`
    })
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
        console.log(`  ${formatOwnerRef(failure.owner)}: ${failure.message}`)
}

function printReport(report: Report, elapsedSeconds: number): void {
    const counted = [...report.validatedCounts.values()].reduce(
        (total, count) => total + count,
        0
    )
    const skipped = [...report.notValidatedCounts.values()].reduce(
        (total, count) => total + count,
        0
    )
    const { validated, notValidated } = partitionReferencingColumns()

    console.log("Validated stored grapher configs")
    console.log(
        `Database: ${GRAPHER_DB_HOST}:${GRAPHER_DB_PORT}/${GRAPHER_DB_NAME}`
    )
    console.log(`Rows: ${counted + skipped + report.unreferencedIds.length}`)
    console.log(`Date: ${new Date().toISOString()}`)
    console.log("")

    console.log("Validated, by the column that references them:")
    printColumnCounts(validated, report.validatedCounts)
    console.log("")

    console.log("Not validated, by the column that references them:")
    printColumnCounts(notValidated, report.notValidatedCounts)
    console.log("")

    console.log("Validation issues:")
    for (const line of renderValidationIssues(
        report.validationIssues,
        report.validatedCounts
    ))
        console.log(line)
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
