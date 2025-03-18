import * as db from "../db.js"

export const ExplorersTableName = "explorers"

export interface DbPlainExplorer {
    slug: string
    // TSV comes from API
    tsv: string
    lastCommit: string
    createdAt: Date
    updatedAt: Date
}

export interface DbEnrichedExplorer extends DbPlainExplorer {
    // these properties are populated from Buildkite's pipeline "Mirror explorers to MySQL"
    // and shouldn't be relied on
    config: string
    isPublished: boolean
}

export async function upsertExplorer(
    knex: db.KnexReadWriteTransaction,
    slug: string,
    tsv: string
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
                updatedAt: new Date(),
            })

        return existingExplorer.slug
    } else {
        // Create new explorer
        // isPublished is currently set in the TSV
        // TODO: do this via const newExplorer = explorer.setPublished(false)
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
        .where({ slug })
        .first()
    return row
}

export async function getAllExplorers(
    knex: db.KnexReadonlyTransaction
): Promise<DbPlainExplorer[]> {
    const rows = await knex<DbPlainExplorer>(ExplorersTableName)
    return rows
}
