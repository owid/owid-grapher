import { KnexReadonlyTransaction } from "../db.js"
import {
    MultiDimDataPagesTableName,
    DbPlainMultiDimDataPage,
    DbEnrichedMultiDimDataPage,
} from "@ourworldindata/types"

const enrichRow = (
    row: DbPlainMultiDimDataPage
): DbEnrichedMultiDimDataPage => ({
    ...row,
    config: JSON.parse(row.config),
})

export const getAllMultiDimDataPages = async (
    knex: KnexReadonlyTransaction,
    onlyPublished = true
): Promise<Map<string, DbEnrichedMultiDimDataPage>> => {
    const rows = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    ).where({
        published: onlyPublished ? true : undefined,
    })

    return new Map(rows.map((row) => [row.slug, enrichRow(row)]))
}

export const getMultiDimDataPageBySlug = async (
    knex: KnexReadonlyTransaction,
    slug: string
): Promise<DbEnrichedMultiDimDataPage | undefined> => {
    const row = await knex<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .where({ slug })
        .first()

    return row ? enrichRow(row) : undefined
}
