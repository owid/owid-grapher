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

export const getAllPublishedMultiDimDataPages = async (
    knex: KnexReadonlyTransaction
): Promise<Map<string, DbEnrichedMultiDimDataPage>> => {
    const rows = await knex<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    ).where("published", true)

    // Published mdims must have a slug.
    return new Map(rows.map((row) => [row.slug!, enrichRow(row)]))
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
        WHERE pgl.linkType = '${OwidGdocLinkType.Grapher}'
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
    const row = await knex<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .where({ slug, ...createOnlyPublishedFilter(onlyPublished) })
        .first()

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
    const row = await knex<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .where({ catalogPath })
        .first()
    return row ? enrichRow(row) : undefined
}
