import {
    ArchivedChartVersionsTableName,
    ArchivedPageVersion,
    DbInsertArchivedChartVersion,
    DbPlainArchivedChartVersion,
    GrapherChecksumsObjectWithHash,
} from "@ourworldindata/types"
import {
    ArchivalTimestamp,
    convertToArchivalDateStringIfNecessary,
} from "@ourworldindata/utils"
import { stringify } from "safe-stable-stringify"
import {
    assembleGrapherArchivalUrl,
    GrapherArchivalManifest,
} from "../../serverUtils/archivalUtils.js"
import { ARCHIVE_BASE_URL } from "../../settings/serverSettings.js"
import * as db from "../db.js"

export async function getLatestArchivedChartVersions(
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<
    Pick<
        DbPlainArchivedChartVersion,
        "grapherId" | "grapherSlug" | "archivalTimestamp" | "hashOfInputs"
    >[]
> {
    const queryBuilder = knex<DbPlainArchivedChartVersion>(
        ArchivedChartVersionsTableName
    )
        .select("grapherId", "grapherSlug", "archivalTimestamp", "hashOfInputs")
        .whereRaw(
            `(grapherId, archivalTimestamp) IN (SELECT grapherId, MAX(archivalTimestamp) FROM archived_chart_versions a2 GROUP BY grapherId)`
        )
    if (chartIds) {
        queryBuilder.whereIn("grapherId", chartIds)
    }
    return await queryBuilder
}

export async function getLatestArchivedChartPageVersions(
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<Record<number, ArchivedPageVersion>> {
    const rows = await getLatestArchivedChartVersions(knex, chartIds)
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

export async function getLatestArchivedChartPageVersionsIfEnabled(
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<Record<number, ArchivedPageVersion>> {
    if (!ARCHIVE_BASE_URL) return {}
    return await getLatestArchivedChartPageVersions(knex, chartIds)
}

export async function getLatestArchivedChartVersionHashes(
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[]
): Promise<Map<number, string>> {
    const rows = await getLatestArchivedChartVersions(knex, chartIds)
    return new Map(rows.map((row) => [row.grapherId, row.hashOfInputs]))
}

export async function insertArchivedChartVersions(
    knex: db.KnexReadWriteTransaction,
    versions: GrapherChecksumsObjectWithHash[],
    date: ArchivalTimestamp,
    manifests: Record<number, GrapherArchivalManifest>
): Promise<void> {
    const rows: DbInsertArchivedChartVersion[] = versions.map((v) => ({
        grapherId: v.chartId,
        grapherSlug: v.chartSlug,
        archivalTimestamp: date.date,
        hashOfInputs: v.checksumsHashed,
        manifest: stringify(manifests[v.chartId], undefined, 2),
    }))
    await knex.batchInsert(ArchivedChartVersionsTableName, rows)
}

export async function getArchivedChartVersionsByChartId(
    knex: db.KnexReadonlyTransaction,
    chartId: number
): Promise<
    Pick<DbPlainArchivedChartVersion, "archivalTimestamp" | "grapherSlug">[]
> {
    return await knex<DbPlainArchivedChartVersion>(
        ArchivedChartVersionsTableName
    )
        .select("archivalTimestamp", "grapherSlug")
        .where("grapherId", chartId)
        .orderBy("archivalTimestamp", "asc")
}
