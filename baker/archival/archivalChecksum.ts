import {
    ArchivedChartVersionsTableName,
    DbInsertArchivedChartVersion,
    DbPlainArchivedChartVersion,
    JsonString,
} from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { partition, pick } from "lodash"
import { stringify } from "safe-stable-stringify"
import { hashHex } from "../../serverUtils/hash.js"
import { ArchivalManifest, ArchivalTimestamp } from "./archivalUtils.js"

export interface GrapherChecksums {
    chartConfigMd5: string
    indicators: {
        [id: string]: { metadataChecksum: string; dataChecksum: string }
    }
}

export interface GrapherChecksumsObject {
    chartId: number
    chartSlug: string
    checksums: GrapherChecksums
}

export interface GrapherChecksumsObjectWithHash extends GrapherChecksumsObject {
    checksumsHashed: string
}

// Fetches checksum/hash information about all published charts from the database
const getGrapherChecksumsFromDb = async (knex: db.KnexReadonlyTransaction) => {
    type FlatGrapherChecksums = {
        chartId: number
        chartSlug: string
        chartConfigMd5: string
        indicators: JsonString
    }

    const rows: GrapherChecksumsObject[] = await db
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

    return rows
}

export const getLatestArchivedVersionsFromDb = async (
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<
    Pick<
        DbPlainArchivedChartVersion,
        "grapherId" | "grapherSlug" | "archivalTimestamp" | "hashOfInputs"
    >[]
> => {
    return db.knexRaw(
        knex,
        `-- sql
        SELECT grapherId, grapherSlug, archivalTimestamp, hashOfInputs
        FROM archived_chart_versions a1
        WHERE (grapherId, archivalTimestamp) IN (SELECT grapherId, MAX(archivalTimestamp) FROM archived_chart_versions a2 GROUP BY grapherId)
            AND (
                 grapherId IN (:chartIds)
                 OR (:chartIdsIsNull)
            )
        `,
        { chartIds: chartIds ?? null, chartIdsIsNull: !chartIds }
    )
}

const hashChecksumsObj = (checksums: GrapherChecksums) => {
    const stringified = stringify(
        pick(checksums, "chartConfigMd5", "indicators")
    )
    const hashed = hashHex(stringified, null)
    return hashed
}
const findHashesInDb = async (
    knex: db.KnexReadonlyTransaction,
    hashes: string[]
) => {
    const rows: Pick<DbPlainArchivedChartVersion, "hashOfInputs">[] =
        await knex(ArchivedChartVersionsTableName)
            .select("hashOfInputs")
            .whereIn("hashOfInputs", hashes)
    return new Set(rows.map((r) => r.hashOfInputs))
}

export const findChangedGrapherPages = async (
    knex: db.KnexReadonlyTransaction
) => {
    const allChartChecksums = await getGrapherChecksumsFromDb(knex)

    const checksums: GrapherChecksumsObjectWithHash[] = allChartChecksums.map(
        (chartObj) => {
            const checksumsHashed = hashChecksumsObj(chartObj.checksums)
            return { ...chartObj, checksumsHashed }
        }
    )

    // We're gonna find the hashes of all the graphers that are already archived and up-to-date
    const hashesFoundInDb = await findHashesInDb(
        knex,
        checksums.map((c) => c.checksumsHashed)
    )
    const [alreadyArchived, needToBeArchived] = partition(checksums, (c) =>
        hashesFoundInDb.has(c.checksumsHashed)
    )

    console.log("total published graphers", checksums.length)
    console.log("already archived", alreadyArchived.length)
    console.log("need archived", needToBeArchived.length)

    return needToBeArchived
}

export const insertChartVersions = async (
    knex: db.KnexReadWriteTransaction,
    versions: GrapherChecksumsObjectWithHash[],
    date: ArchivalTimestamp,
    manifests: Record<number, ArchivalManifest>
) => {
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
