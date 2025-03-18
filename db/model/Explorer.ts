import * as db from "../db.js"

export const ExplorersTableName = "explorers"

export interface DbPlainExplorer {
    id: number
    slug: string
    // this is populated from Buildkite's job
    config: string
    // this comes from API
    tsv: string
    isPublished: boolean
    // catalogPath: string
    createdAt: Date
    updatedAt: Date
}

export interface DbEnrichedExplorer extends Omit<DbPlainExplorer, "config"> {
    config: any
}

export async function upsertExplorer(
    knex: db.KnexReadWriteTransaction,
    slug: string,
    tsv: string
): Promise<number> {
    // Check if explorer with this catalog path already exists
    const existingExplorer = await knex<DbPlainExplorer>(ExplorersTableName)
        .where({ slug })
        .first()

    if (existingExplorer) {
        // Update existing explorer with new config
        await knex<DbPlainExplorer>(ExplorersTableName)
            .where({ id: existingExplorer.id })
            .update({
                tsv,
                updatedAt: new Date(),
            })

        return existingExplorer.id
    } else {
        // Create new explorer
        const [id] = await knex<DbPlainExplorer>(ExplorersTableName).insert({
            tsv,
            slug,
            isPublished: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        return id
    }
}

export async function getExplorerBySlug(
    knex: db.KnexReadonlyTransaction,
    slug: string
): Promise<DbPlainExplorer | undefined> {
    return await knex<DbPlainExplorer>(ExplorersTableName)
        .where({ slug })
        .first()
}

export async function getAllExplorers(
    knex: db.KnexReadonlyTransaction
): Promise<DbEnrichedExplorer[]> {
    const rows = await knex<DbPlainExplorer>(ExplorersTableName)
    return rows
}
