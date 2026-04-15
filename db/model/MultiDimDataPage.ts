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
import { buildQueryStrFromConfig } from "./MultiDimRedirects.js"

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

export interface LinkedMultiDimDataPage {
    id: number
    slug: string
    config: MultiDimDataPageConfigEnriched
    /** The slug the gdoc author linked to. Equals `slug` for direct links,
     *  or the old/redirected slug for links resolved via multi_dim_redirects. */
    originalSlug: string
    /** Query string derived from the viewConfigId in multi_dim_redirects,
     *  only present for redirected links that target a specific view. */
    queryStr?: string
}

export async function getAllLinkedPublishedMultiDimDataPages(
    knex: KnexReadonlyTransaction
): Promise<LinkedMultiDimDataPage[]> {
    // 1. Direct links: the gdoc links to the multi-dim's current slug
    const directRows = await knexRaw<
        Pick<DbPlainMultiDimDataPage, "config"> & { id: number; slug: string }
    >(
        knex,
        `-- sql
        SELECT
            mddp.id as id,
            mddp.slug as slug,
            mddp.config as config
        FROM multi_dim_data_pages mddp
        JOIN posts_gdocs_links pgl ON pgl.target = mddp.slug
        WHERE pgl.linkType = '${ContentGraphLinkType.Grapher}'
        AND mddp.published = true`
    )

    // 2. Redirected links: the gdoc links to an old slug that redirects to a
    //    multi-dim via multi_dim_redirects
    const redirectedRows = await knexRaw<
        Pick<DbPlainMultiDimDataPage, "config"> & {
            id: number
            slug: string
            originalSlug: string
            viewConfigId: string | null
        }
    >(
        knex,
        `-- sql
        SELECT
            mddp.id as id,
            mddp.slug as slug,
            mddp.config as config,
            pgl.target as originalSlug,
            mdr.viewConfigId as viewConfigId
        FROM multi_dim_redirects mdr
        JOIN multi_dim_data_pages mddp ON mddp.id = mdr.multiDimId
        JOIN posts_gdocs_links pgl
            ON pgl.target = REPLACE(mdr.source, '/grapher/', '')
        WHERE pgl.linkType = '${ContentGraphLinkType.Grapher}'
        AND mddp.published = true
        AND mdr.source LIKE '/grapher/%'`
    )

    const directResults: LinkedMultiDimDataPage[] = directRows.map((row) => {
        const enriched = enrichRow(row)
        return { ...enriched, originalSlug: enriched.slug }
    })

    const redirectedResults: LinkedMultiDimDataPage[] = redirectedRows.map(
        (row) => {
            const { viewConfigId, originalSlug, ...rest } = row
            const enriched = enrichRow(rest)
            const queryStr = viewConfigId
                ? buildQueryStrFromConfig(
                      viewConfigId,
                      rest.config,
                      enriched.slug
                  )
                : undefined
            return { ...enriched, originalSlug, queryStr }
        }
    )

    return [...directResults, ...redirectedResults]
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
