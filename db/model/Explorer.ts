import {
    KnexReadonlyTransaction,
    KnexReadWriteTransaction,
    knexRaw,
    knexRawFirst,
} from "../db.js"
import {
    DbInsertExplorer,
    DbPlainExplorer,
    ExplorersTableName,
} from "@ourworldindata/types"
import { areSetsEqual } from "@ourworldindata/utils"
import { parseExplorer } from "../explorerParser.js"
import { enqueueJob, updateExplorerRefreshStatus } from "./Jobs.js"

type PlainExplorerWithLastCommit = Required<DbPlainExplorer> & {
    // lastCommit is a relic from our git-CMS days, it should be broken down
    // to individual fields in the future
    lastCommit: string
}

// Define an interface for the join result from explorers and users tables
interface ExplorerWithUserInfo extends DbPlainExplorer {
    fullName: string | null
    email: string | null
}

// Define a type for the explorer configuration
type ExplorerConfig = {
    blocks?: {
        type: string
        block?: {
            grapherId?: string | number
            yVariableIds?: string
            ySlugs?: string
            xVariableId?: string
            colorVariableId?: string
            sizeVariableId?: string
            transform?: string
        }[]
    }[]
    isPublished?: string
}

function createLastCommit(
    row: { lastEditedAt: Date; commitMessage: string },
    fullName?: string | null,
    email?: string | null
): string {
    const lastCommit = {
        date: row.lastEditedAt ? row.lastEditedAt.toISOString() : "",
        message: row.commitMessage || "",
        author_name: fullName || "",
        author_email: email || "",
    }
    return JSON.stringify(lastCommit)
}

function detectChartIds(config: ExplorerConfig): number[] {
    const chartIds: number[] = []
    if (config.blocks && Array.isArray(config.blocks)) {
        for (const block of config.blocks) {
            if (block.type === "graphers" && Array.isArray(block.block)) {
                for (const row of block.block) {
                    const grapherId = row.grapherId
                    if (grapherId) {
                        chartIds.push(Number(grapherId))
                    }
                }
            }
        }
    }
    return chartIds
}

function detectVariableIdsAndCatalogPaths(config: ExplorerConfig): Set<string> {
    const variableIdsAndCatalogPaths = new Set<string>()
    if (config.blocks && Array.isArray(config.blocks)) {
        for (const block of config.blocks) {
            if (block.type === "graphers" && Array.isArray(block.block)) {
                for (const row of block.block) {
                    if (row.yVariableIds) {
                        row.yVariableIds
                            .split(/\s+/)
                            .forEach((id: string) =>
                                variableIdsAndCatalogPaths.add(id)
                            )
                    }
                    if (row.xVariableId) {
                        variableIdsAndCatalogPaths.add(row.xVariableId)
                    }
                    if (row.colorVariableId) {
                        variableIdsAndCatalogPaths.add(row.colorVariableId)
                    }
                    if (row.sizeVariableId) {
                        variableIdsAndCatalogPaths.add(row.sizeVariableId)
                    }
                }
            } else if (block.type === "columns" && Array.isArray(block.block)) {
                for (const row of block.block) {
                    // Extract variable ids from transforms like "duplicate 950983"
                    if (row.transform) {
                        const match = row.transform.match(/^duplicate\s+(\d+)$/)
                        if (match) {
                            variableIdsAndCatalogPaths.add(match[1])
                        }
                    }
                }
            }
        }
    }
    return variableIdsAndCatalogPaths
}

async function validateChartIds(
    knex: KnexReadWriteTransaction,
    proposed: number[]
): Promise<number[]> {
    if (!proposed.length) return []
    const foundRows = await knex("charts").whereIn("id", proposed).select("id")
    const found = foundRows.map((row) => row.id)
    const missing = proposed.filter((id) => !found.includes(id))
    if (missing.length > 0) {
        console.warn("Missing charts in db:", missing)
    }
    return found
}

export async function upsertExplorerCharts(
    knex: KnexReadWriteTransaction,
    slug: string,
    config: ExplorerConfig
): Promise<void> {
    const detected = detectChartIds(config)
    const validChartIds = new Set(await validateChartIds(knex, detected))
    const existingRows = await knex("explorer_charts").where({
        explorerSlug: slug,
    })
    const existing = new Set<number>(existingRows.map((row) => row.chartId))

    if (!areSetsEqual(validChartIds, existing)) {
        await knexRaw(
            knex,
            `-- sql
                DELETE FROM explorer_charts
                WHERE explorerSlug = ?
            `,
            [slug]
        )
        for (const chartId of validChartIds) {
            await knexRaw(
                knex,
                `-- sql
                    INSERT INTO explorer_charts (explorerSlug, chartId)
                    VALUES (?, ?)
                `,
                [slug, chartId]
            )
        }
    }
}

async function validateVariableIds(
    knex: KnexReadWriteTransaction,
    proposed: number[],
    isPublished: boolean
): Promise<number[]> {
    if (proposed.length === 0) return []
    const foundRows = await knex("variables")
        .whereIn("id", proposed)
        .select("id")
    const found = foundRows.map((row) => row.id)
    const missing = proposed.filter((id) => !found.includes(id))
    if (missing.length > 0) {
        console.error("missing variables in db", {
            missing_variables: missing,
            isPublished,
        })
    }
    return found
}

export async function upsertExplorerVariables(
    knex: KnexReadWriteTransaction,
    slug: string,
    config: ExplorerConfig
): Promise<void> {
    // Get all variable ids and catalog paths from the explorer config.
    const proposed = detectVariableIdsAndCatalogPaths(config)
    const proposedCatalogPaths = new Set(
        Array.from(proposed).filter((x) => isNaN(Number(x)))
    )
    const proposedVariableIds = new Set(
        Array.from(proposed)
            .filter((x) => !isNaN(Number(x)))
            .map((x) => Number(x))
    )

    // Verify that the total number of items in 'proposed' equals
    // the sum of items in 'proposedCatalogPaths' and 'proposedVariableIds'
    if (
        proposed.size !==
        proposedCatalogPaths.size + proposedVariableIds.size
    ) {
        throw new Error(
            "Mismatch: proposed size does not equal the sum of proposedCatalogPaths and proposedVariableIds sizes"
        )
    }
    const isPublished = config["isPublished"] === "true"

    // Resolve catalog paths to variable ids via a knex query.
    const resolvedRows = await knex("variables")
        .whereIn("catalogPath", Array.from(proposedCatalogPaths))
        .select("id", "catalogPath")
    const foundCatalogPaths = new Set(
        resolvedRows.map((row: any) => row.catalogPath)
    )
    const resolvedVariableIds = new Set<number>(
        resolvedRows.map((row: any) => row.id)
    )
    const missing = Array.from(proposedCatalogPaths).filter(
        (x) => !foundCatalogPaths.has(x)
    )
    if (missing.length > 0) {
        console.error(
            `Couldn't resolve ${missing.length} catalog paths:`,
            missing,
            isPublished
        )
    }
    // Merge proposed variable ids and resolved variable ids.
    const proposedUnion = new Set<number>([
        ...proposedVariableIds,
        ...resolvedVariableIds,
    ])
    const existingRows = await knex("explorer_variables").where({
        explorerSlug: slug,
    })
    const existing = new Set<number>(existingRows.map((row) => row.variableId))

    if (!areSetsEqual(proposedUnion, existing)) {
        console.log("Linking explorer to variables", {
            n_variables: proposedUnion.size,
        })
        const validIds = await validateVariableIds(
            knex,
            Array.from(proposedUnion),
            isPublished
        )
        await knex("explorer_variables").where({ explorerSlug: slug }).delete()
        await knex("explorer_variables").insert(
            validIds.map((variableId) => ({
                explorerSlug: slug,
                variableId,
            }))
        )
    }
}

export async function upsertExplorer(
    knex: KnexReadWriteTransaction,
    data: DbInsertExplorer
): Promise<void> {
    const { slug, tsv, lastEditedByUserId, commitMessage } = data

    // Parse the TSV
    const config = JSON.stringify(parseExplorer(slug, tsv))

    // Check if explorer with this catalog path already exists
    const existingExplorer = await knexRawFirst<DbPlainExplorer>(
        knex,
        `-- sql
            SELECT *
            FROM ${ExplorersTableName}
            WHERE slug = ?
            LIMIT 1
        `,
        [slug]
    )

    // NOTE: We could do an actual upsert on the DB level here (see e.g. upsertMultiDimDataPage)
    if (existingExplorer) {
        // Update existing explorer
        const now = new Date()
        await knexRaw(
            knex,
            `-- sql
                UPDATE ${ExplorersTableName}
                SET
                    tsv = ?,
                    config = ?,
                    commitMessage = ?,
                    lastEditedByUserId = ?,
                    lastEditedAt = ?,
                    updatedAt = ?
                WHERE slug = ?
            `,
            [
                tsv,
                config,
                commitMessage,
                lastEditedByUserId,
                now,
                now,
                existingExplorer.slug,
            ]
        )
    } else {
        // Create new explorer
        // isPublished is currently set in the
        // NOTE: This is a temporary solution. We should get rid of `isPublished` from the         //   and use the `isPublished` column in the database instead.
        const unpublishedTSV = tsv.replace(
            /isPublished\ttrue/g,
            "isPublished\tfalse"
        )

        await knexRaw(
            knex,
            `-- sql
                INSERT INTO ${ExplorersTableName} (
                    tsv,
                    slug,
                    lastEditedByUserId,
                    lastEditedAt,
                    commitMessage,
                    config
                ) VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                unpublishedTSV,
                slug,
                lastEditedByUserId,
                new Date(),
                commitMessage,
                config,
            ]
        )
    }

    await upsertExplorerCharts(knex, slug, JSON.parse(config))
    await upsertExplorerVariables(knex, slug, JSON.parse(config))
}

export async function enqueueExplorerRefreshJobsForDependencies(
    knex: KnexReadWriteTransaction,
    {
        chartIds = [],
        variableIds = [],
    }: { chartIds?: number[]; variableIds?: number[] }
): Promise<void> {
    const slugSet = new Set<string>()

    if (chartIds.length > 0) {
        const chartSlugRows = await knexRaw<{ slug: string }>(
            knex,
            `-- sql
                SELECT DISTINCT ec.explorerSlug AS slug
                FROM explorer_charts ec
                JOIN ${ExplorersTableName} e ON e.slug = ec.explorerSlug
                WHERE ec.chartId IN (?)
                    AND e.isPublished = 1
            `,
            [chartIds]
        )

        for (const row of chartSlugRows) {
            if (row.slug) slugSet.add(row.slug)
        }
    }

    if (variableIds.length > 0) {
        const variableSlugRows = await knexRaw<{ slug: string }>(
            knex,
            `-- sql
                SELECT DISTINCT ev.explorerSlug AS slug
                FROM explorer_variables ev
                JOIN ${ExplorersTableName} e ON e.slug = ev.explorerSlug
                WHERE ev.variableId IN (?)
                    AND e.isPublished = 1
            `,
            [variableIds]
        )

        for (const row of variableSlugRows) {
            if (row.slug) slugSet.add(row.slug)
        }
    }

    if (slugSet.size === 0) return

    const slugs = [...slugSet]
    const explorers = await knexRaw<
        Pick<DbPlainExplorer, "slug" | "updatedAt">
    >(
        knex,
        `-- sql
            SELECT slug, updatedAt
            FROM ${ExplorersTableName}
            WHERE slug IN (?)
        `,
        [slugs]
    )

    for (const explorer of explorers) {
        if (!explorer.updatedAt) continue
        await updateExplorerRefreshStatus(knex, explorer.slug, "queued")
        await enqueueJob(knex, {
            type: "refresh_explorer_views",
            payload: {
                slug: explorer.slug,
                explorerUpdatedAt: explorer.updatedAt,
            },
        })
    }
}

export async function getExplorerBySlug(
    knex: KnexReadonlyTransaction,
    slug: string
): Promise<PlainExplorerWithLastCommit | undefined> {
    const row = await knexRawFirst<ExplorerWithUserInfo>(
        knex,
        `-- sql
            SELECT e.*, u.fullName, u.email
            FROM ${ExplorersTableName} e
            LEFT JOIN users u ON e.lastEditedByUserId = u.id
            WHERE e.slug = ?
            LIMIT 1
        `,
        [slug]
    )

    if (!row) return undefined

    const withCommit: PlainExplorerWithLastCommit = {
        ...row,
        lastCommit: createLastCommit(row, row.fullName, row.email),
    }

    return withCommit
}

export async function getAllExplorers(
    knex: KnexReadonlyTransaction
): Promise<PlainExplorerWithLastCommit[]> {
    // Use left join to fetch users in one query
    const rows = await knexRaw<ExplorerWithUserInfo>(
        knex,
        `-- sql
            SELECT e.*, u.fullName, u.email
            FROM ${ExplorersTableName} e
            LEFT JOIN users u ON e.lastEditedByUserId = u.id
        `
    )

    return rows.map((row) => ({
        ...row,
        lastCommit: createLastCommit(row, row.fullName, row.email),
    }))
}
