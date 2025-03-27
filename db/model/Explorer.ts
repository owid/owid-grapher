import { KnexReadonlyTransaction, KnexReadWriteTransaction } from "../db.js"
import {
    DbInsertExplorer,
    DbPlainExplorer,
    DbPlainExplorerWithLastCommit,
    ExplorersTableName,
} from "@ourworldindata/types"

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

export async function upsertExplorer(
    knex: KnexReadWriteTransaction,
    data: DbInsertExplorer
): Promise<string> {
    const { slug, tsv, lastEditedByUserId, commitMessage } = data
    // Check if explorer with this catalog path already exists
    const existingExplorer = await knex<DbPlainExplorer>(ExplorersTableName)
        .where({ slug })
        .first()

    // NOTE: We could do an actual upsert on the DB level here (see e.g. upsertMultiDimDataPage)
    if (existingExplorer) {
        // Update existing explorer with new config
        await knex<DbPlainExplorer>(ExplorersTableName)
            .where({ slug: existingExplorer.slug })
            .update({
                tsv,
                commitMessage,
                lastEditedByUserId,
                lastEditedAt: new Date(),
                updatedAt: new Date(),
            })

        return existingExplorer.slug
    } else {
        // Create new explorer
        // isPublished is currently set in the
        // NOTE: This is a temporary solution. We should get rid of `isPublished` from the         //   and use the `isPublished` column in the database instead.
        const unpublishedTSV = tsv.replace(
            /isPublished\ttrue/g,
            "isPublished\tfalse"
        )

        await knex<DbPlainExplorer>(ExplorersTableName).insert({
            tsv: unpublishedTSV,
            slug,
            lastEditedByUserId,
            lastEditedAt: new Date(),
            commitMessage,
            config: "{}",
        })
        return slug
    }
}

export async function getExplorerBySlug(
    knex: KnexReadonlyTransaction,
    slug: string
): Promise<DbPlainExplorerWithLastCommit | undefined> {
    const row = await knex<DbPlainExplorer>(ExplorersTableName)
        .leftJoin(
            "users",
            `${ExplorersTableName}.lastEditedByUserId`,
            "users.id"
        )
        .select(`${ExplorersTableName}.*`, "users.fullName", "users.email")
        .where({ slug })
        .first()

    if (row) {
        row.lastCommit = createLastCommit(
            row,
            (row as any).fullName,
            (row as any).email
        )
    }

    return row
}

export async function getAllExplorers(
    knex: KnexReadonlyTransaction
): Promise<DbPlainExplorerWithLastCommit[]> {
    // Use left join to fetch users in one query
    const rows = await knex<DbPlainExplorer>(ExplorersTableName)
        .leftJoin(
            "users",
            `${ExplorersTableName}.lastEditedByUserId`,
            "users.id"
        )
        .select(`${ExplorersTableName}.*`, "users.fullName", "users.email")

    rows.forEach((row) => {
        row.lastCommit = createLastCommit(
            row,
            (row as any).fullName,
            (row as any).email
        )
    })
    return rows
}
