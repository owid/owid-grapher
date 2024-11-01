import { KnexReadonlyTransaction, KnexReadWriteTransaction } from "../db.js"
import {
    MultiDimDataPagesTableName,
    DbInsertMultiDimDataPage,
    DbPlainMultiDimDataPage,
    DbEnrichedMultiDimDataPage,
} from "@ourworldindata/types"

/**
 * Returns zero if none of the inserted columns differs from the existing ones,
 * ID of the upserted row otherwise.
 */
export async function upsertMultiDimDataPage(
    knex: KnexReadWriteTransaction,
    data: DbInsertMultiDimDataPage
): Promise<number> {
    const result = await knex<DbInsertMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .insert(data)
        .onConflict()
        .merge()
    return result[0]
}

const createOnlyPublishedFilter = (
    onlyPublished: boolean
): Record<string, any> => (onlyPublished ? { published: true } : {})

const enrichRow = (
    row: DbPlainMultiDimDataPage
): DbEnrichedMultiDimDataPage => ({
    ...row,
    config: JSON.parse(row.config),
})

export const getAllMultiDimDataPages = async (
    knex: KnexReadonlyTransaction,
    { onlyPublished = true }: { onlyPublished?: boolean } = {}
): Promise<Map<string, DbEnrichedMultiDimDataPage>> => {
    const rows = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    ).where({
        ...createOnlyPublishedFilter(onlyPublished),
    })

    return new Map(rows.map((row) => [row.slug, enrichRow(row)]))
}

export const getMultiDimDataPageBySlug = async (
    knex: KnexReadonlyTransaction,
    slug: string,
    { onlyPublished = true }: { onlyPublished?: boolean } = {}
): Promise<DbEnrichedMultiDimDataPage | undefined> => {
    const row = await knex<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .where({ slug, ...createOnlyPublishedFilter(onlyPublished) })
        .first()

    return row ? enrichRow(row) : undefined
}
