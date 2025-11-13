import {
    ArchivedPageVersion,
    ArchivedPostVersionsTableName,
    DbInsertArchivedPostVersion,
    DbPlainArchivedPostVersion,
    PostChecksumsObjectWithHash,
} from "@ourworldindata/types"
import {
    ArchivalTimestamp,
    convertToArchivalDateStringIfNecessary,
} from "@ourworldindata/utils"
import { stringify } from "safe-stable-stringify"
import {
    assemblePostArchivalUrl,
    PostArchivalManifest,
} from "../../serverUtils/archivalUtils.js"
import { ARCHIVE_BASE_URL } from "../../settings/serverSettings.js"
import * as db from "../db.js"

export async function getLatestArchivedPostVersions(
    knex: db.KnexReadonlyTransaction,
    postIds?: string[]
): Promise<
    Pick<
        DbPlainArchivedPostVersion,
        "postId" | "postSlug" | "archivalTimestamp" | "hashOfInputs"
    >[]
> {
    const queryBuilder = knex<DbPlainArchivedPostVersion>(
        `${ArchivedPostVersionsTableName} as a1`
    )
        .select(
            "a1.postId",
            "a1.postSlug",
            "a1.archivalTimestamp",
            "a1.hashOfInputs"
        )
        .joinRaw(
            `-- sql
            INNER JOIN (
                SELECT postId, MAX(archivalTimestamp) as latestArchivalTimestamp
                FROM archived_post_versions
                GROUP BY postId
            ) a2 ON a1.postId = a2.postId AND a1.archivalTimestamp = a2.latestArchivalTimestamp`
        )

    if (postIds) {
        queryBuilder.whereIn("a1.postId", postIds)
    }

    return await queryBuilder
}

export async function getLatestArchivedPostPageVersions(
    knex: db.KnexReadonlyTransaction,
    postIds?: string[]
): Promise<Record<string, ArchivedPageVersion>> {
    const rows = await getLatestArchivedPostVersions(knex, postIds)
    return Object.fromEntries(
        rows.map((r) => [
            r.postId,
            {
                archivalDate: convertToArchivalDateStringIfNecessary(
                    r.archivalTimestamp
                ),
                archiveUrl: assemblePostArchivalUrl(
                    r.archivalTimestamp,
                    r.postSlug,
                    {
                        relative: false,
                    }
                ),
                versionsFileUrl: `${ARCHIVE_BASE_URL}/versions/posts/${r.postId}.json`,
                type: "archived-page-version",
            },
        ])
    )
}

export async function getLatestArchivedPostPageVersionsIfEnabled(
    knex: db.KnexReadonlyTransaction,
    postIds?: string[]
): Promise<Record<string, ArchivedPageVersion>> {
    if (!ARCHIVE_BASE_URL) return {}
    return await getLatestArchivedPostPageVersions(knex, postIds)
}

export async function getLatestArchivedPostVersionHashes(
    knex: db.KnexReadonlyTransaction,
    postIds?: string[]
): Promise<Map<string, string>> {
    const rows = await getLatestArchivedPostVersions(knex, postIds)
    return new Map(rows.map((row) => [row.postId, row.hashOfInputs]))
}

export async function insertArchivedPostVersions(
    knex: db.KnexReadWriteTransaction,
    versions: PostChecksumsObjectWithHash[],
    date: ArchivalTimestamp,
    manifests: Record<string, PostArchivalManifest>
): Promise<void> {
    const rows: DbInsertArchivedPostVersion[] = versions.map((v) => ({
        postId: v.postId,
        postSlug: v.postSlug,
        archivalTimestamp: date.date,
        hashOfInputs: v.checksumsHashed,
        manifest: stringify(manifests[v.postSlug], undefined, 2),
    }))
    await knex.batchInsert(ArchivedPostVersionsTableName, rows)
}

export async function getArchivedPostVersionsByPostId(
    knex: db.KnexReadonlyTransaction,
    postId: string
): Promise<
    Pick<DbPlainArchivedPostVersion, "archivalTimestamp" | "postSlug">[]
> {
    return await knex<DbPlainArchivedPostVersion>(ArchivedPostVersionsTableName)
        .select("archivalTimestamp", "postSlug")
        .where("postId", postId)
        .orderBy("archivalTimestamp", "asc")
}
