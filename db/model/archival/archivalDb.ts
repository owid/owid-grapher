import * as _ from "lodash-es"
import { logErrorAndMaybeCaptureInSentry } from "../../../serverUtils/errorLog.js"
import {
    ArchivedChartVersionsTableName,
    ArchivedMultiDimVersionsTableName,
    ArchivedExplorerVersionsTableName,
    ArchivedPageVersion,
    DbInsertArchivedChartVersion,
    DbInsertArchivedMultiDimVersion,
    DbInsertArchivedExplorerVersion,
    DbPlainArchivedChartVersion,
    DbPlainMultiDimDataPage,
    DbPlainArchivedMultiDimVersion,
    DbPlainArchivedExplorerVersion,
    DbPlainExplorer,
    JsonString,
    MultiDimDataPagesTableName,
    MultiDimDataPageConfigEnriched,
    ExplorersTableName,
    GrapherChecksumsObjectWithHash,
    GrapherChecksums,
    MultiDimChecksums,
    MultiDimChecksumsObjectWithHash,
    ExplorerChecksums,
    ExplorerChecksumsObjectWithHash,
    ExplorerVariablesTableName,
    DbPlainExplorerVariable,
    VariablesTableName,
    DbRawVariable,
    parseChartConfig,
} from "@ourworldindata/types"
import * as db from "../../db.js"
import { stringify } from "safe-stable-stringify"
import { hashHex } from "../../../serverUtils/hash.js"
import {
    ArchivalTimestamp,
    convertToArchivalDateStringIfNecessary,
    getAllVariableIds,
} from "@ourworldindata/utils"
import {
    assembleGrapherArchivalUrl,
    assembleMultiDimArchivalUrl,
    assembleExplorerArchivalUrl,
    GrapherArchivalManifest,
    MultiDimArchivalManifest,
    ExplorerArchivalManifest,
} from "../../../serverUtils/archivalUtils.js"
import { ARCHIVE_BASE_URL } from "../../../settings/serverSettings.js"

type VariableChecksums = Pick<DbRawVariable, "id"> & {
    // All variables used in production should have checksums.
    metadataChecksum: string
    dataChecksum: string
}

// Fetches checksum/hash information about all published charts from the database
export const getGrapherChecksumsFromDb = async (
    knex: db.KnexReadonlyTransaction
): Promise<GrapherChecksumsObjectWithHash[]> => {
    type FlatGrapherChecksums = {
        chartId: number
        chartSlug: string
        chartConfigMd5: string
        indicators: JsonString
    }

    const rows: GrapherChecksumsObjectWithHash[] = await db
        .knexRaw<FlatGrapherChecksums>(
            knex,
            // This query gets all published charts and their hashes, and all associated variables (keyed by variableId) and their checksums
            `-- sql
        SELECT
            c.id AS chartId,
            cc.slug AS chartSlug,
            cc.fullMd5 AS chartConfigMd5,
            JSON_OBJECTAGG(v.id, JSON_OBJECT("metadataChecksum", v.metadataChecksum, "dataChecksum", v.dataChecksum)) AS indicators
        FROM charts c
        JOIN chart_configs cc on c.configId = cc.id
        JOIN chart_dimensions cd on cd.chartId = c.id
        JOIN variables v on cd.variableId = v.id
        WHERE cc.full ->> "$.isPublished" = "true"
        GROUP BY c.id
        ORDER BY c.id
        `
        )
        .then((row) =>
            row.map((r) => ({
                chartId: r.chartId,
                chartSlug: r.chartSlug,
                checksums: {
                    chartConfigMd5: r.chartConfigMd5,
                    indicators: JSON.parse(r.indicators),
                },
            }))
        )
        .then((row) =>
            row.map((r) => ({
                ...r,
                checksumsHashed: hashGrapherChecksumsObj(r.checksums),
            }))
        )

    return rows
}

export const getLatestGrapherArchivedVersionsFromDb = async (
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<
    Pick<
        DbPlainArchivedChartVersion,
        "grapherId" | "grapherSlug" | "archivalTimestamp"
    >[]
> => {
    const queryBuilder = knex<DbPlainArchivedChartVersion>(
        ArchivedChartVersionsTableName
    )
        .select("grapherId", "grapherSlug", "archivalTimestamp")
        .whereRaw(
            `(grapherId, archivalTimestamp) IN (SELECT grapherId, MAX(archivalTimestamp) FROM archived_chart_versions a2 GROUP BY grapherId)`
        )

    if (chartIds) {
        queryBuilder.whereIn("grapherId", chartIds)
    }

    return await queryBuilder
}

export const getLatestMultiDimArchivedVersionsFromDb = async (
    knex: db.KnexReadonlyTransaction,
    multiDimIds?: number[]
): Promise<
    Pick<
        DbPlainArchivedMultiDimVersion,
        "multiDimId" | "multiDimSlug" | "archivalTimestamp"
    >[]
> => {
    const queryBuilder = knex<DbPlainArchivedMultiDimVersion>(
        ArchivedMultiDimVersionsTableName
    )
        .select("multiDimId", "multiDimSlug", "archivalTimestamp")
        .whereRaw(
            `(multiDimId, archivalTimestamp) IN (SELECT multiDimId, MAX(archivalTimestamp) FROM archived_multi_dim_versions a2 GROUP BY multiDimId)`
        )

    if (multiDimIds) {
        queryBuilder.whereIn("multiDimId", multiDimIds)
    }

    return await queryBuilder
}

export const getLatestGrapherArchivedVersions = async (
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<Record<number, ArchivedPageVersion>> => {
    const rows = await getLatestGrapherArchivedVersionsFromDb(knex, chartIds)

    return Object.fromEntries(
        rows.map((r) => [
            r.grapherId,
            {
                archivalDate: convertToArchivalDateStringIfNecessary(
                    r.archivalTimestamp
                ),
                archiveUrl: assembleGrapherArchivalUrl(
                    r.archivalTimestamp,
                    r.grapherSlug,
                    {
                        relative: false,
                    }
                ),
                type: "archived-page-version",
            },
        ])
    )
}

export const getLatestChartArchivedVersionsIfEnabled = async (
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<Record<number, ArchivedPageVersion>> => {
    if (!ARCHIVE_BASE_URL) return {}

    return await getLatestGrapherArchivedVersions(knex, chartIds)
}

export const getLatestMultiDimArchivedVersions = async (
    knex: db.KnexReadonlyTransaction,
    multiDimIds?: number[]
): Promise<Record<number, ArchivedPageVersion>> => {
    const rows = await getLatestMultiDimArchivedVersionsFromDb(
        knex,
        multiDimIds
    )

    return Object.fromEntries(
        rows.map((r) => [
            r.multiDimId,
            {
                archivalDate: convertToArchivalDateStringIfNecessary(
                    r.archivalTimestamp
                ),
                archiveUrl: assembleMultiDimArchivalUrl(
                    r.archivalTimestamp,
                    r.multiDimSlug,
                    {
                        relative: false,
                    }
                ),
                type: "archived-page-version",
            },
        ])
    )
}

export const getLatestMultiDimArchivedVersionsIfEnabled = async (
    knex: db.KnexReadonlyTransaction,
    multiDimIds?: number[]
): Promise<Record<number, ArchivedPageVersion>> => {
    if (!ARCHIVE_BASE_URL) return {}

    return await getLatestMultiDimArchivedVersions(knex, multiDimIds)
}

const hashGrapherChecksumsObj = (checksums: GrapherChecksums): string => {
    const stringified = stringify(
        _.pick(checksums, "chartConfigMd5", "indicators")
    )
    const hashed = hashHex(stringified, null)
    return hashed
}

const hashMultiDimChecksumsObj = (checksums: MultiDimChecksums): string => {
    const stringified = stringify(
        _.pick(checksums, "multiDimConfigMd5", "chartConfigs", "indicators")
    )
    const hashed = hashHex(stringified, null)
    return hashed
}

const hashExplorerChecksumsObj = (checksums: ExplorerChecksums): string => {
    const stringified = stringify(
        _.pick(checksums, "explorerConfigMd5", "chartConfigs", "indicators")
    )
    const hashed = hashHex(stringified, null)
    return hashed
}

const findGrapherHashesInDb = async (
    knex: db.KnexReadonlyTransaction,
    hashes: string[]
): Promise<Set<string>> => {
    const rows = await knex<DbPlainArchivedChartVersion>(
        ArchivedChartVersionsTableName
    )
        .select("hashOfInputs")
        .whereIn("hashOfInputs", hashes)
    return new Set(rows.map((r) => r.hashOfInputs))
}

const findMultiDimHashesInDb = async (
    knex: db.KnexReadonlyTransaction,
    hashes: string[]
): Promise<Set<string>> => {
    const rows = await knex<DbPlainArchivedMultiDimVersion>(
        ArchivedMultiDimVersionsTableName
    )
        .select("hashOfInputs")
        .whereIn("hashOfInputs", hashes)
    return new Set(rows.map((r) => r.hashOfInputs))
}

const findExplorerHashesInDb = async (
    knex: db.KnexReadonlyTransaction,
    hashes: string[]
): Promise<Set<string>> => {
    const rows = await knex<DbPlainArchivedExplorerVersion>(
        ArchivedExplorerVersionsTableName
    )
        .select("hashOfInputs")
        .whereIn("hashOfInputs", hashes)
    return new Set(rows.map((r) => r.hashOfInputs))
}

export const findChangedGrapherPages = async (
    knex: db.KnexReadonlyTransaction
): Promise<GrapherChecksumsObjectWithHash[]> => {
    const allChartChecksums = await getGrapherChecksumsFromDb(knex)

    // We're gonna find the hashes of all the graphers that are already archived and up-to-date
    const hashesFoundInDb = await findGrapherHashesInDb(
        knex,
        allChartChecksums.map((c) => c.checksumsHashed)
    )
    const [alreadyArchived, needToBeArchived] = _.partition(
        allChartChecksums,
        (c) => hashesFoundInDb.has(c.checksumsHashed)
    )

    console.log("total published graphers", allChartChecksums.length)
    console.log("already archived", alreadyArchived.length)
    console.log("need archived", needToBeArchived.length)

    return needToBeArchived
}

export const findChangedMultiDimPages = async (
    knex: db.KnexReadonlyTransaction
): Promise<MultiDimChecksumsObjectWithHash[]> => {
    const allMultiDimChecksums = await getMultiDimChecksumsFromDb(knex)

    // We're gonna find the hashes of all the multi-dim pages that are already archived and up-to-date
    const hashesFoundInDb = await findMultiDimHashesInDb(
        knex,
        allMultiDimChecksums.map((c) => c.checksumsHashed)
    )
    const [alreadyArchived, needToBeArchived] = _.partition(
        allMultiDimChecksums,
        (c) => hashesFoundInDb.has(c.checksumsHashed)
    )

    console.log("total published multi-dim pages", allMultiDimChecksums.length)
    console.log("already archived", alreadyArchived.length)
    console.log("need archived", needToBeArchived.length)

    return needToBeArchived
}

export const insertChartVersions = async (
    knex: db.KnexReadWriteTransaction,
    versions: GrapherChecksumsObjectWithHash[],
    date: ArchivalTimestamp,
    manifests: Record<number, GrapherArchivalManifest>
): Promise<void> => {
    const rows: DbInsertArchivedChartVersion[] = versions.map((v) => ({
        grapherId: v.chartId,
        grapherSlug: v.chartSlug,
        archivalTimestamp: date.date,
        hashOfInputs: v.checksumsHashed,
        manifest: stringify(manifests[v.chartId], undefined, 2),
    }))

    if (rows.length)
        await knex.batchInsert(ArchivedChartVersionsTableName, rows)
}

export const insertMultiDimVersions = async (
    knex: db.KnexReadWriteTransaction,
    versions: MultiDimChecksumsObjectWithHash[],
    date: ArchivalTimestamp,
    manifests: Record<number, MultiDimArchivalManifest>
): Promise<void> => {
    const rows: DbInsertArchivedMultiDimVersion[] = versions.map((v) => ({
        multiDimId: v.multiDimId,
        multiDimSlug: v.multiDimSlug,
        archivalTimestamp: date.date,
        hashOfInputs: v.checksumsHashed,
        manifest: stringify(manifests[v.multiDimId], undefined, 2),
    }))

    if (rows.length)
        await knex.batchInsert(ArchivedMultiDimVersionsTableName, rows)
}

export const getAllChartVersionsForChartId = async (
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<
    Pick<DbPlainArchivedChartVersion, "archivalTimestamp" | "grapherSlug">[]
> => {
    const rows = await knex<DbPlainArchivedChartVersion>(
        ArchivedChartVersionsTableName
    )
        .select("archivalTimestamp", "grapherSlug")
        .where("grapherId", chartId)
        .orderBy("archivalTimestamp", "asc")
    return rows
}

// Fetches checksum/hash information about all published multi-dim data pages from the database
export const getMultiDimChecksumsFromDb = async (
    knex: db.KnexReadonlyTransaction
): Promise<MultiDimChecksumsObjectWithHash[]> => {
    // Get all published multi-dim data pages
    const multiDimPages = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .select("id", "slug", "config", "configMd5")
        .where("published", true)
        .orderBy("id")

    if (multiDimPages.length === 0) return []

    // Get chart config MD5s for each multi-dim page
    type ChartConfigResult = {
        multiDimId: number
        chartConfigId: string
        chartConfigMd5: string
    }

    const chartConfigRows = await db.knexRaw<ChartConfigResult>(
        knex,
        `-- sql
        SELECT
            mdxcc.multiDimId,
            mdxcc.chartConfigId,
            cc.fullMd5 AS chartConfigMd5
        FROM multi_dim_x_chart_configs mdxcc
        JOIN chart_configs cc ON mdxcc.chartConfigId = cc.id
        WHERE mdxcc.multiDimId IN (${multiDimPages.map(() => "?").join(",")})`,
        multiDimPages.map((p) => p.id)
    )

    // Group chart configs by multiDimId
    const chartConfigsByMultiDimId = new Map<number, Record<string, string>>()
    for (const row of chartConfigRows) {
        if (!chartConfigsByMultiDimId.has(row.multiDimId)) {
            chartConfigsByMultiDimId.set(row.multiDimId, {})
        }
        chartConfigsByMultiDimId.get(row.multiDimId)![row.chartConfigId] =
            row.chartConfigMd5
    }

    // Extract all variable IDs from configs
    let allVariableIds = new Set<number>()
    const configsByMultiDimId = new Map<
        number,
        MultiDimDataPageConfigEnriched
    >()

    for (const page of multiDimPages) {
        const config: MultiDimDataPageConfigEnriched = JSON.parse(page.config)
        configsByMultiDimId.set(page.id, config)
        allVariableIds = allVariableIds.union(getAllVariableIds(config.views))
    }

    // Get variable checksums
    const variableChecksums = await knex<VariableChecksums>(VariablesTableName)
        .select("id", "metadataChecksum", "dataChecksum")
        .whereIn("id", Array.from(allVariableIds))

    const variableChecksumsMap = new Map(
        variableChecksums.map((v) => [
            v.id.toString(),
            {
                metadataChecksum: v.metadataChecksum,
                dataChecksum: v.dataChecksum,
            },
        ])
    )

    // Build result
    return await Promise.all(
        multiDimPages.map(async (page) => {
            const config = configsByMultiDimId.get(page.id)!
            const chartConfigs = chartConfigsByMultiDimId.get(page.id) || {}

            // Get indicators used in this multi-dim page
            const usedVariableIds = getAllVariableIds(config.views)

            const indicators: {
                [id: string]: { metadataChecksum: string; dataChecksum: string }
            } = {}
            for (const variableId of usedVariableIds) {
                const checksum = variableChecksumsMap.get(variableId.toString())
                if (checksum) {
                    indicators[variableId.toString()] = checksum
                } else {
                    await logErrorAndMaybeCaptureInSentry(
                        new Error(
                            `Variable ${variableId} is missing a checksum`
                        )
                    )
                }
            }

            const checksums: MultiDimChecksums = {
                multiDimConfigMd5: page.configMd5,
                chartConfigs,
                indicators,
            }

            return {
                multiDimId: page.id,
                multiDimSlug: page.slug || "",
                checksums,
                checksumsHashed: hashMultiDimChecksumsObj(checksums),
            }
        })
    )
}

export const getAllMultiDimVersionsForId = async (
    knex: db.KnexReadonlyTransaction,
    multiDimId: number
): Promise<
    Pick<DbPlainArchivedMultiDimVersion, "archivalTimestamp" | "multiDimSlug">[]
> => {
    const rows = await knex<DbPlainArchivedMultiDimVersion>(
        ArchivedMultiDimVersionsTableName
    )
        .select("archivalTimestamp", "multiDimSlug")
        .where("multiDimId", multiDimId)
        .orderBy("archivalTimestamp", "asc")
    return rows
}

export const getExplorerChecksumsFromDb = async (
    knex: db.KnexReadonlyTransaction
): Promise<ExplorerChecksumsObjectWithHash[]> => {
    // Get all published explorers that are either indicator-based or grapher-based
    // (excludes CSV-based explorers that have no variables or charts)
    const explorers = await knex<DbPlainExplorer>(ExplorersTableName)
        .select("slug", "config", "configMd5")
        .where("isPublished", true)
        .where(function () {
            this.whereExists(function () {
                this.select("*")
                    .from(ExplorerVariablesTableName)
                    .whereRaw("explorerSlug = explorers.slug")
            }).orWhereExists(function () {
                this.select("*")
                    .from("explorer_charts")
                    .whereRaw("explorerSlug = explorers.slug")
            })
        })
        .orderBy("slug")

    if (explorers.length === 0) return []

    type ViewConfigResult = {
        explorerSlug: string
        chartConfigId: string
        chartConfigMd5: string
        chartConfigFull: string
    }

    const viewConfigRows = await db.knexRaw<ViewConfigResult>(
        knex,
        `-- sql
        SELECT
            ev.explorerSlug,
            ev.chartConfigId,
            cc.fullMd5 AS chartConfigMd5,
            cc.full AS chartConfigFull
        FROM explorer_views ev
        JOIN chart_configs cc ON ev.chartConfigId = cc.id
        WHERE ev.chartConfigId IS NOT NULL
          AND ev.explorerSlug IN (${explorers.map(() => "?").join(",")})`,
        explorers.map((e) => e.slug)
    )

    // Group per-view chart configs by explorerSlug (chartConfigId -> MD5)
    const chartConfigsByExplorerSlug = new Map<string, Record<string, string>>()
    for (const row of viewConfigRows) {
        if (!chartConfigsByExplorerSlug.has(row.explorerSlug)) {
            chartConfigsByExplorerSlug.set(row.explorerSlug, {})
        }
        chartConfigsByExplorerSlug.get(row.explorerSlug)![row.chartConfigId] =
            row.chartConfigMd5
    }

    // Get variable IDs used by explorers
    // 1) From explorer_variables (indicator-based references captured by config)
    const allVariableIds = new Set<number>()
    const variablesByExplorerSlug = new Map<string, Set<number>>()

    const explorerVariableRows = await knex<DbPlainExplorerVariable>(
        ExplorerVariablesTableName
    )
        .select("explorerSlug", "variableId")
        .whereIn(
            "explorerSlug",
            explorers.map((e) => e.slug)
        )

    for (const row of explorerVariableRows) {
        if (!variablesByExplorerSlug.has(row.explorerSlug)) {
            variablesByExplorerSlug.set(row.explorerSlug, new Set<number>())
        }
        variablesByExplorerSlug.get(row.explorerSlug)!.add(row.variableId)
        allVariableIds.add(row.variableId)
    }

    // 2) From generated explorer view configs (both grapher- and indicator-based)
    for (const row of viewConfigRows) {
        const slug = row.explorerSlug
        if (!variablesByExplorerSlug.has(slug)) {
            variablesByExplorerSlug.set(slug, new Set<number>())
        }
        const config = parseChartConfig(row.chartConfigFull)
        if (config.dimensions) {
            for (const dimension of config.dimensions) {
                const variableId = dimension.variableId
                variablesByExplorerSlug.get(slug)?.add(variableId)
                allVariableIds.add(variableId)
            }
        }
    }

    // Get variable checksums
    const variableChecksums = await knex<VariableChecksums>(VariablesTableName)
        .select("id", "metadataChecksum", "dataChecksum")
        .whereIn("id", Array.from(allVariableIds))

    const variableChecksumsMap = new Map(
        variableChecksums.map((v) => [
            v.id.toString(),
            {
                metadataChecksum: v.metadataChecksum,
                dataChecksum: v.dataChecksum,
            },
        ])
    )

    return await Promise.all(
        explorers.map(async (explorer) => {
            const chartConfigs =
                chartConfigsByExplorerSlug.get(explorer.slug) || {}
            const usedVariableIds = Array.from(
                variablesByExplorerSlug.get(explorer.slug) || []
            )

            const indicators: {
                [id: string]: { metadataChecksum: string; dataChecksum: string }
            } = {}
            for (const variableId of usedVariableIds) {
                const checksum = variableChecksumsMap.get(variableId.toString())
                if (checksum) {
                    indicators[variableId.toString()] = checksum
                } else {
                    await logErrorAndMaybeCaptureInSentry(
                        new Error(
                            `Variable ${variableId} is missing a checksum`
                        )
                    )
                }
            }

            const checksums: ExplorerChecksums = {
                explorerConfigMd5: explorer.configMd5,
                chartConfigs,
                indicators,
            }

            return {
                explorerSlug: explorer.slug,
                checksums,
                checksumsHashed: hashExplorerChecksumsObj(checksums),
            }
        })
    )
}

export const findChangedExplorerPages = async (
    knex: db.KnexReadonlyTransaction
): Promise<ExplorerChecksumsObjectWithHash[]> => {
    const allExplorerChecksums = await getExplorerChecksumsFromDb(knex)

    // We're gonna find the hashes of all the explorers that are already archived and up-to-date
    const hashesFoundInDb = await findExplorerHashesInDb(
        knex,
        allExplorerChecksums.map((c) => c.checksumsHashed)
    )
    const [alreadyArchived, needToBeArchived] = _.partition(
        allExplorerChecksums,
        (c) => hashesFoundInDb.has(c.checksumsHashed)
    )

    console.log("total published explorers", allExplorerChecksums.length)
    console.log("already archived", alreadyArchived.length)
    console.log("need archived", needToBeArchived.length)

    return needToBeArchived
}

export const insertExplorerVersions = async (
    knex: db.KnexReadWriteTransaction,
    versions: ExplorerChecksumsObjectWithHash[],
    date: ArchivalTimestamp,
    manifests: Record<string, ExplorerArchivalManifest>
): Promise<void> => {
    const rows: DbInsertArchivedExplorerVersion[] = versions.map((v) => ({
        explorerSlug: v.explorerSlug,
        archivalTimestamp: date.date,
        hashOfInputs: v.checksumsHashed,
        manifest: stringify(manifests[v.explorerSlug], undefined, 2),
    }))

    if (rows.length)
        await knex.batchInsert(ArchivedExplorerVersionsTableName, rows)
}

export const getLatestExplorerArchivedVersionsFromDb = async (
    knex: db.KnexReadonlyTransaction,
    slugs?: string[]
): Promise<
    Pick<DbPlainArchivedExplorerVersion, "explorerSlug" | "archivalTimestamp">[]
> => {
    const queryBuilder = knex<DbPlainArchivedExplorerVersion>(
        ArchivedExplorerVersionsTableName
    )
        .select("explorerSlug", "archivalTimestamp")
        .whereRaw(
            `(explorerSlug, archivalTimestamp) IN (SELECT explorerSlug, MAX(archivalTimestamp) FROM archived_explorer_versions a2 GROUP BY explorerSlug)`
        )

    if (slugs) {
        queryBuilder.whereIn("explorerSlug", slugs)
    }

    return await queryBuilder
}

export const getAllExplorerVersionsForSlug = async (
    knex: db.KnexReadonlyTransaction,
    explorerSlug: string
): Promise<
    Pick<DbPlainArchivedExplorerVersion, "archivalTimestamp" | "explorerSlug">[]
> => {
    const rows = await knex<DbPlainArchivedExplorerVersion>(
        ArchivedExplorerVersionsTableName
    )
        .select("archivalTimestamp", "explorerSlug")
        .where("explorerSlug", explorerSlug)
        .orderBy("archivalTimestamp", "asc")
    return rows
}

export const getLatestExplorerArchivedVersions = async (
    knex: db.KnexReadonlyTransaction,
    slugs?: string[]
): Promise<Record<string, ArchivedPageVersion>> => {
    const rows = await getLatestExplorerArchivedVersionsFromDb(knex, slugs)

    return Object.fromEntries(
        rows.map((r) => [
            r.explorerSlug,
            {
                archivalDate: convertToArchivalDateStringIfNecessary(
                    r.archivalTimestamp
                ),
                archiveUrl: assembleExplorerArchivalUrl(
                    r.archivalTimestamp,
                    r.explorerSlug,
                    { relative: false }
                ),
                type: "archived-page-version",
            },
        ])
    )
}

export const getLatestExplorerArchivedVersionsIfEnabled = async (
    knex: db.KnexReadonlyTransaction,
    slugs?: string[]
): Promise<Record<string, ArchivedPageVersion>> => {
    if (!ARCHIVE_BASE_URL) return {}

    return await getLatestExplorerArchivedVersions(knex, slugs)
}
