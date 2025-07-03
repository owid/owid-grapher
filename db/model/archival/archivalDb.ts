import * as _ from "lodash-es"
import {
    ArchivedChartVersionsTableName,
    ArchivedMultiDimVersionsTableName,
    ArchivedPageVersion,
    DbInsertArchivedChartVersion,
    DbInsertArchivedMultiDimVersion,
    DbPlainArchivedChartVersion,
    DbPlainMultiDimDataPage,
    DbPlainArchivedMultiDimVersion,
    JsonString,
    MultiDimDataPagesTableName,
    MultiDimDataPageConfigEnriched,
    GrapherChecksumsObjectWithHash,
    GrapherChecksums,
    MultiDimChecksums,
    MultiDimChecksumsObjectWithHash,
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
    GrapherArchivalManifest,
    MultiDimArchivalManifest,
} from "../../../serverUtils/archivalUtils.js"
import { ARCHIVE_BASE_URL } from "../../../settings/serverSettings.js"

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
    const variableChecksums = await knex("variables")
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
    return multiDimPages.map((page) => {
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
