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
    ContentGraphLinkType,
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

export async function multiDimDataPageExists(
    knex: KnexReadonlyTransaction,
    data: Partial<DbPlainMultiDimDataPage>
): Promise<boolean> {
    const result = await knex(MultiDimDataPagesTableName)
        .select(knex.raw("1"))
        .where(data)
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

export async function getAllPublishedMultiDimDataPages(
    knex: KnexReadonlyTransaction
): Promise<DbEnrichedMultiDimDataPage[]> {
    const rows = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    ).where("published", true)
    return rows.map(enrichRow)
}

export const getAllPublishedMultiDimDataPagesBySlug = async (
    knex: KnexReadonlyTransaction
): Promise<Map<string, DbEnrichedMultiDimDataPage>> => {
    const multiDims = await getAllPublishedMultiDimDataPages(knex)
    // Published mdims must have a slug.
    return new Map(multiDims.map((multiDim) => [multiDim.slug!, multiDim]))
}

export async function getAllLinkedPublishedMultiDimDataPages(
    knex: KnexReadonlyTransaction
): Promise<{ slug: string; config: MultiDimDataPageConfigEnriched }[]> {
    const rows = await knexRaw<
        Pick<DbPlainMultiDimDataPage, "config"> & { slug: string }
    >(
        knex,
        `-- sql
        SELECT
            mddp.slug as slug,
            mddp.config as config
        FROM multi_dim_data_pages mddp
        JOIN posts_gdocs_links pgl ON pgl.target = mddp.slug
        WHERE pgl.linkType = '${ContentGraphLinkType.Grapher}'
        AND mddp.published = true`
    )
    return rows.map(enrichRow)
}

export async function getAllMultiDimDataPageSlugs(
    knex: KnexReadonlyTransaction
): Promise<string[]> {
    const rows = await knex<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .select("slug")
        .whereNotNull("slug")
    return rows.map((row) => row.slug!)
}

export const getMultiDimDataPageBySlug = async (
    knex: KnexReadonlyTransaction,
    slug: string,
    { onlyPublished = true }: { onlyPublished?: boolean } = {}
): Promise<DbEnrichedMultiDimDataPage | undefined> => {
    console.log(
        `[DEBUG] getMultiDimDataPageBySlug - Looking for slug: ${slug}, onlyPublished: ${onlyPublished}`
    )
    console.time(`mdim-db-slug-${slug}`)

    const row = await knex<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .where({ slug, ...createOnlyPublishedFilter(onlyPublished) })
        .first()

    console.timeEnd(`mdim-db-slug-${slug}`)
    console.log(
        `[DEBUG] getMultiDimDataPageBySlug - Found result: ${row ? "yes" : "no"}`
    )

    return row ? enrichRow(row) : undefined
}

export async function getMultiDimDataPageById(
    knex: KnexReadonlyTransaction,
    id: number
): Promise<DbEnrichedMultiDimDataPage | undefined> {
    const row = await knex<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .where({ id })
        .first()
    return row ? enrichRow(row) : undefined
}

export async function getMultiDimDataPageByCatalogPath(
    knex: KnexReadonlyTransaction,
    catalogPath: string
): Promise<DbEnrichedMultiDimDataPage | undefined> {
    console.log(
        `[DEBUG] getMultiDimDataPageByCatalogPath - Looking for catalog path: ${catalogPath}`
    )
    console.time(`mdim-db-catalog-${catalogPath}`)

    const row = await knex<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .where({ catalogPath })
        .first()

    console.timeEnd(`mdim-db-catalog-${catalogPath}`)
    console.log(
        `[DEBUG] getMultiDimDataPageByCatalogPath - Found result: ${row ? "yes" : "no"}`
    )

    return row ? enrichRow(row) : undefined
}
