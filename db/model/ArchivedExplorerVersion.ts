import {
    ArchivedExplorerVersionsTableName,
    ArchivedPageVersion,
    DbInsertArchivedExplorerVersion,
    DbPlainArchivedExplorerVersion,
    ExplorerChecksumsObjectWithHash,
} from "@ourworldindata/types"
import {
    ArchivalTimestamp,
    convertToArchivalDateStringIfNecessary,
} from "@ourworldindata/utils"
import { stringify } from "safe-stable-stringify"
import {
    assembleExplorerArchivalUrl,
    ExplorerArchivalManifest,
} from "../../serverUtils/archivalUtils.js"
import { ARCHIVE_BASE_URL } from "../../settings/serverSettings.js"
import * as db from "../db.js"

export async function getLatestArchivedExplorerVersions(
    knex: db.KnexReadonlyTransaction,
    slugs?: string[]
): Promise<
    Pick<DbPlainArchivedExplorerVersion, "explorerSlug" | "archivalTimestamp">[]
> {
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

export async function getLatestArchivedExplorerPageVersions(
    knex: db.KnexReadonlyTransaction,
    slugs?: string[]
): Promise<Record<string, ArchivedPageVersion>> {
    const rows = await getLatestArchivedExplorerVersions(knex, slugs)
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

export async function getLatestArchivedExplorerPageVersionsIfEnabled(
    knex: db.KnexReadonlyTransaction,
    slugs?: string[]
): Promise<Record<string, ArchivedPageVersion>> {
    if (!ARCHIVE_BASE_URL) return {}
    return await getLatestArchivedExplorerPageVersions(knex, slugs)
}

export async function getExistingArchivedExplorerVersionHashes(
    knex: db.KnexReadonlyTransaction,
    hashes: string[]
): Promise<Set<string>> {
    const rows = await knex<DbPlainArchivedExplorerVersion>(
        ArchivedExplorerVersionsTableName
    )
        .select("hashOfInputs")
        .whereIn("hashOfInputs", hashes)
        .pluck("hashOfInputs")
    return new Set(rows)
}

export async function insertArchivedExplorerVersions(
    knex: db.KnexReadWriteTransaction,
    versions: ExplorerChecksumsObjectWithHash[],
    date: ArchivalTimestamp,
    manifests: Record<string, ExplorerArchivalManifest>
): Promise<void> {
    const rows: DbInsertArchivedExplorerVersion[] = versions.map((v) => ({
        explorerSlug: v.explorerSlug,
        archivalTimestamp: date.date,
        hashOfInputs: v.checksumsHashed,
        manifest: stringify(manifests[v.explorerSlug], undefined, 2),
    }))
    await knex.batchInsert(ArchivedExplorerVersionsTableName, rows)
}

export async function getArchivedExplorerVersionsByExplorerSlug(
    knex: db.KnexReadonlyTransaction,
    explorerSlug: string
): Promise<
    Pick<DbPlainArchivedExplorerVersion, "archivalTimestamp" | "explorerSlug">[]
> {
    return await knex<DbPlainArchivedExplorerVersion>(
        ArchivedExplorerVersionsTableName
    )
        .select("archivalTimestamp", "explorerSlug")
        .where("explorerSlug", explorerSlug)
        .orderBy("archivalTimestamp", "asc")
}
