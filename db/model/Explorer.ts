import * as db from "../db.js"

export const ExplorersTableName = "explorers"

export interface DbPlainExplorer {
    slug: string
    tsv: string
    isPublished: boolean
    lastCommit: string
    lastEditedByUserId: number
    lastEditedAt: Date
    commitMessage: string
    createdAt: Date
    updatedAt: Date
}

export interface DbEnrichedExplorer extends DbPlainExplorer {
    // these properties are populated from Buildkite's pipeline "Mirror explorers to MySQL"
    config: string
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

export async function upsertExplorer(
    knex: db.KnexReadWriteTransaction,
    slug: string,
    tsv: string,
    lastEditedByUserId: number,
    commitMessage: string
): Promise<string> {
    // Check if explorer with this catalog path already exists
    const existingExplorer = await knex<DbPlainExplorer>(ExplorersTableName)
        .where({ slug })
        .first()

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
        // isPublished is currently set in the TSV
        const unpublishedTSV = tsv.replace(
            /isPublished\ttrue/g,
            "isPublished\tfalse"
        )

        await knex<DbEnrichedExplorer>(ExplorersTableName).insert({
            tsv: unpublishedTSV,
            slug,
            lastCommit: "{}",
            createdAt: new Date(),
            updatedAt: new Date(),
            lastEditedByUserId,
            lastEditedAt: new Date(),
            commitMessage,
            isPublished: false,
            config: "{}",
        })
        return slug
    }
}

export async function getExplorerBySlug(
    knex: db.KnexReadonlyTransaction,
    slug: string
): Promise<DbPlainExplorer | undefined> {
    const row = await knex<DbPlainExplorer>(ExplorersTableName)
        .leftJoin(
            "users",
            `${ExplorersTableName}.lastEditedByUserId`,
            "users.id"
        )
        .select(`${ExplorersTableName}.*`, "users.fullName", "users.email")
        .where({ slug })
        .first()

    if (row && row.lastEditedByUserId) {
        row.lastCommit = createLastCommit(
            row,
            (row as any).fullName,
            (row as any).email
        )
    }

    return row
}

export async function getAllExplorers(
    knex: db.KnexReadonlyTransaction
): Promise<DbPlainExplorer[]> {
    // Use left join to fetch users in one query
    const rows = await knex<DbPlainExplorer>(ExplorersTableName)
        .leftJoin(
            "users",
            `${ExplorersTableName}.lastEditedByUserId`,
            "users.id"
        )
        .select(`${ExplorersTableName}.*`, "users.fullName", "users.email")

    rows.forEach((row) => {
        const fullName = (row as any).fullName
        const email = (row as any).email
        if (row.lastEditedByUserId) {
            row.lastCommit = createLastCommit(row, fullName, email)
        }
    })
    return rows
}
