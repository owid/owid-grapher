import {
    knexRaw,
    KnexReadonlyTransaction,
    KnexReadWriteTransaction,
} from "../db.js"
import {
    MultiDimDataPagesTableName,
    DbInsertMultiDimDataPage,
    DbPlainMultiDimDataPage,
    DbEnrichedMultiDimDataPage,
    OwidGdocLinkType,
    JsonString,
    MultiDimDataPageConfigEnriched,
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

export async function isMultiDimDataPagePublished(
    knex: KnexReadonlyTransaction,
    slug: string
): Promise<boolean> {
    const result = await knex(MultiDimDataPagesTableName)
        .select(knex.raw("1"))
        .where({ slug, published: true })
        .first()
    return Boolean(result)
}

const createOnlyPublishedFilter = (
    onlyPublished: boolean
): Record<string, any> => (onlyPublished ? { published: true } : {})

const enrichRow = <T extends { config: JsonString }>(
    row: T
): Omit<T, "config"> & { config: MultiDimDataPageConfigEnriched } => ({
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

export async function getAllLinkedPublishedMultiDimDataPages(
    knex: KnexReadonlyTransaction
): Promise<Pick<DbEnrichedMultiDimDataPage, "slug" | "config">[]> {
    const rows = await knexRaw<
        Pick<DbPlainMultiDimDataPage, "slug" | "config">
    >(
        knex,
        `-- sql
        SELECT
            mddp.slug as slug,
            mddp.config as config
        FROM multi_dim_data_pages mddp
        JOIN posts_gdocs_links pgl ON pgl.target = mddp.slug
        WHERE pgl.linkType = '${OwidGdocLinkType.Grapher}'
        AND mddp.published = true`
    )
    return rows.map(enrichRow)
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
