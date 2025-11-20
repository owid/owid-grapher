import {
    ArchivedMultiDimVersionsTableName,
    ArchivedPageVersion,
    DbInsertArchivedMultiDimVersion,
    DbPlainArchivedMultiDimVersion,
    MultiDimChecksumsObjectWithHash,
} from "@ourworldindata/types"
import {
    ArchivalTimestamp,
    convertToArchivalDateStringIfNecessary,
} from "@ourworldindata/utils"
import { stringify } from "safe-stable-stringify"
import {
    assembleMultiDimArchivalUrl,
    MultiDimArchivalManifest,
} from "../../serverUtils/archivalUtils.js"
import { ARCHIVE_BASE_URL } from "../../settings/serverSettings.js"
import * as db from "../db.js"

export async function getLatestArchivedMultiDimVersions(
    knex: db.KnexReadonlyTransaction,
    multiDimIds?: number[]
): Promise<
    Pick<
        DbPlainArchivedMultiDimVersion,
        "multiDimId" | "multiDimSlug" | "archivalTimestamp" | "hashOfInputs"
    >[]
> {
    const queryBuilder = knex<DbPlainArchivedMultiDimVersion>(
        `${ArchivedMultiDimVersionsTableName} as a1`
    )
        .select(
            "a1.multiDimId",
            "a1.multiDimSlug",
            "a1.archivalTimestamp",
            "a1.hashOfInputs"
        )
        .joinRaw(
            `-- sql
            INNER JOIN (
                SELECT multiDimId, MAX(archivalTimestamp) as latestArchivalTimestamp
                FROM archived_multi_dim_versions
                GROUP BY multiDimId
            ) a2 ON a1.multiDimId = a2.multiDimId AND a1.archivalTimestamp = a2.latestArchivalTimestamp`
        )
    if (multiDimIds) {
        queryBuilder.whereIn("a1.multiDimId", multiDimIds)
    }
    return await queryBuilder
}

export async function getLatestArchivedMultiDimPageVersions(
    knex: db.KnexReadonlyTransaction,
    multiDimIds?: number[]
): Promise<Record<number, ArchivedPageVersion>> {
    const rows = await getLatestArchivedMultiDimVersions(knex, multiDimIds)
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

export async function getLatestArchivedMultiDimPageVersionsIfEnabled(
    knex: db.KnexReadonlyTransaction,
    multiDimIds?: number[]
): Promise<Record<number, ArchivedPageVersion>> {
    if (!ARCHIVE_BASE_URL) return {}
    return await getLatestArchivedMultiDimPageVersions(knex, multiDimIds)
}

export async function getLatestArchivedMultiDimVersionHashes(
    knex: db.KnexReadonlyTransaction,
    multiDimIds?: number[]
): Promise<Map<number, string>> {
    const rows = await getLatestArchivedMultiDimVersions(knex, multiDimIds)
    return new Map(rows.map((row) => [row.multiDimId, row.hashOfInputs]))
}

export async function insertArchivedMultiDimVersions(
    knex: db.KnexReadWriteTransaction,
    versions: MultiDimChecksumsObjectWithHash[],
    date: ArchivalTimestamp,
    manifests: Record<number, MultiDimArchivalManifest>
): Promise<void> {
    const rows: DbInsertArchivedMultiDimVersion[] = versions.map((v) => ({
        multiDimId: v.multiDimId,
        multiDimSlug: v.multiDimSlug,
        archivalTimestamp: date.date,
        hashOfInputs: v.checksumsHashed,
        manifest: stringify(manifests[v.multiDimId], undefined, 2),
    }))
    await knex.batchInsert(ArchivedMultiDimVersionsTableName, rows)
}

export async function getArchivedMultiDimVersionsByMultiDimId(
    knex: db.KnexReadonlyTransaction,
    multiDimId: number
): Promise<
    Pick<DbPlainArchivedMultiDimVersion, "archivalTimestamp" | "multiDimSlug">[]
> {
    return await knex<DbPlainArchivedMultiDimVersion>(
        ArchivedMultiDimVersionsTableName
    )
        .select("archivalTimestamp", "multiDimSlug")
        .where("multiDimId", multiDimId)
        .orderBy("archivalTimestamp", "asc")
}
