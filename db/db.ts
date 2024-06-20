import { knex, Knex } from "knex"
import {
    GRAPHER_DB_HOST,
    GRAPHER_DB_USER,
    GRAPHER_DB_PASS,
    GRAPHER_DB_NAME,
    GRAPHER_DB_PORT,
} from "../settings/serverSettings.js"
import { registerExitHandler } from "./cleanup.js"
import { keyBy } from "@ourworldindata/utils"
import {
    DbChartTagJoin,
    ImageMetadata,
    MinimalDataInsightInterface,
    OwidGdocType,
    DBRawPostGdocWithTags,
    parsePostsGdocsWithTagsRow,
    DBEnrichedPostGdocWithTags,
    DbEnrichedPostGdoc,
    DbRawPostGdoc,
    parsePostsGdocsRow,
    TagGraphRootName,
    FlatTagGraph,
    FlatTagGraphNode,
    MinimalTagWithIsTopic,
} from "@ourworldindata/types"
import { groupBy } from "lodash"

// Return the first match from a mysql query
export const closeTypeOrmAndKnexConnections = async (): Promise<void> => {
    if (_knexInstance) {
        await _knexInstance.destroy()
        _knexInstance = undefined
    }
}

let _knexInstance: Knex | undefined = undefined

export const knexInstance = (): Knex<any, any[]> => {
    if (_knexInstance) return _knexInstance

    _knexInstance = knex({
        client: "mysql2",
        connection: {
            host: GRAPHER_DB_HOST,
            user: GRAPHER_DB_USER,
            password: GRAPHER_DB_PASS,
            database: GRAPHER_DB_NAME,
            port: GRAPHER_DB_PORT,
            charset: "utf8mb4",
            typeCast: (field: any, next: any) => {
                if (field.type === "TINY" && field.length === 1) {
                    return field.string() === "1" // 1 = true, 0 = false
                }

                return next()
            },

            // The mysql2 driver will return JSON objects by default, which is nice, but we have many code paths that
            // expect JSON strings, so we instead tell it to return JSON strings.
            //@ts-expect-error This is an option in mysql2 v3.10+, but it's not yet reflected in the knex types
            jsonStrings: true,
        },
    })

    registerExitHandler(async () => {
        if (_knexInstance) await _knexInstance.destroy()
    })

    return _knexInstance
}

declare const __read_capability: unique symbol
declare const __write_capability: unique symbol
export type KnexReadonlyTransaction = Knex.Transaction<any, any[]> & {
    readonly [__read_capability]: "read"
}

export type KnexReadWriteTransaction = Knex.Transaction<any, any[]> & {
    readonly [__read_capability]: "read"
    readonly [__write_capability]: "write"
}

export enum TransactionCloseMode {
    Close,
    KeepOpen,
}

async function knexTransaction<T, KT>(
    transactionFn: (trx: KT) => Promise<T>,
    closeConnection: TransactionCloseMode,
    readonly: boolean,
    knex: Knex<any, any[]>
): Promise<T> {
    try {
        const options = readonly ? { readOnly: true } : {}
        const result = await knex.transaction(
            async (trx) => transactionFn(trx as KT),
            options
        )
        return result
    } finally {
        if (closeConnection === TransactionCloseMode.Close) {
            await knex.destroy()
            if (knex === _knexInstance) _knexInstance = undefined
        }
    }
}

export async function knexReadonlyTransaction<T>(
    transactionFn: (trx: KnexReadonlyTransaction) => Promise<T>,
    closeConnection: TransactionCloseMode = TransactionCloseMode.KeepOpen,
    knex: Knex<any, any[]> = knexInstance()
): Promise<T> {
    return knexTransaction(transactionFn, closeConnection, true, knex)
}

export async function knexReadWriteTransaction<T>(
    transactionFn: (trx: KnexReadWriteTransaction) => Promise<T>,
    closeConnection: TransactionCloseMode = TransactionCloseMode.KeepOpen,
    knex: Knex<any, any[]> = knexInstance()
): Promise<T> {
    return knexTransaction(transactionFn, closeConnection, false, knex)
}
export const knexRaw = async <TRow = unknown>(
    knex: Knex<any, any[]>,
    str: string,
    params?: any[] | Record<string, any>
): Promise<TRow[]> => {
    try {
        const rawReturnConstruct = await knex.raw(str, params ?? [])
        return rawReturnConstruct[0]
    } catch (e) {
        console.error("Exception when executing SQL statement!", {
            sql: str,
            params,
            error: e,
        })
        throw e
    }
}

export const knexRawFirst = async <TRow = unknown>(
    knex: KnexReadonlyTransaction,
    str: string,
    params?: any[] | Record<string, any>
): Promise<TRow | undefined> => {
    const results = await knexRaw<TRow>(knex, str, params)
    if (results.length === 0) return undefined
    return results[0]
}

export const knexRawInsert = async (
    knex: KnexReadWriteTransaction,
    str: string,
    params?: any[]
): Promise<{ insertId: number }> => (await knex.raw(str, params ?? []))[0]

/**
 *  In the backporting workflow, the users create gdoc posts for posts. As long as these are not yet published,
 *  we still want to bake them from the WP posts. Once the users presses publish there though, we want to stop
 *  baking them from the wordpress post. This funciton fetches all the slugs of posts that have been published via gdocs,
 *  to help us exclude them from the baking process.
 */
export const getSlugsWithPublishedGdocsSuccessors = async (
    knex: KnexReadonlyTransaction
): Promise<Set<string>> => {
    return knexRaw(
        knex,
        `-- sql
            SELECT
                slug
            FROM
                posts_with_gdoc_publish_status
            WHERE
                isGdocPublished = TRUE`
    ).then((rows) => new Set(rows.map((row: any) => row.slug)))
}

export const getExplorerTags = async (
    knex: KnexReadonlyTransaction
): Promise<{ slug: string; tags: DbChartTagJoin[] }[]> => {
    return knexRaw<{ slug: string; tags: string }>(
        knex,
        `-- sql
        SELECT
        ext.explorerSlug as slug,
        CASE
            WHEN COUNT(t.id) = 0 THEN JSON_ARRAY()
            ELSE JSON_ARRAYAGG(JSON_OBJECT('name', t.name, 'id', t.id))
        END AS tags
        FROM
            explorer_tags ext
        LEFT JOIN tags t ON
            ext.tagId = t.id
        GROUP BY
            ext.explorerSlug`
    ).then((rows) =>
        rows.map((row) => ({
            slug: row.slug,
            tags: JSON.parse(row.tags) as DbChartTagJoin[],
        }))
    )
}

export const getPublishedExplorersBySlug = async (
    knex: KnexReadonlyTransaction
): Promise<{
    [slug: string]: {
        slug: string
        title: string
        subtitle: string
        tags: DbChartTagJoin[]
    }
}> => {
    const tags = await getExplorerTags(knex)
    const tagsBySlug = keyBy(tags, "slug")
    return knexRaw(
        knex,
        `-- sql
        SELECT
            slug,
            config->>"$.explorerTitle" as title,
            config->>"$.explorerSubtitle" as subtitle
        FROM
            explorers
        WHERE
            isPublished = TRUE`
    ).then((rows) => {
        const processed = rows.map((row: any) => {
            return {
                slug: row.slug,
                title: row.title,
                subtitle: row.subtitle === "null" ? "" : row.subtitle,
                tags: tagsBySlug[row.slug]?.tags ?? [],
            }
        })
        return keyBy(processed, "slug")
    })
}

export const getPublishedDataInsights = (
    knex: KnexReadonlyTransaction,
    limit = Number.MAX_SAFE_INTEGER // default to no limit
): Promise<MinimalDataInsightInterface[]> => {
    return knexRaw(
        knex,
        `-- sql
        SELECT
            content->>'$.title' AS title,
            content->>'$.authors' AS authors,
            publishedAt,
            updatedAt,
            slug,
            ROW_NUMBER() OVER (ORDER BY publishedAt DESC) - 1 AS \`index\`
        FROM posts_gdocs
        WHERE type = '${OwidGdocType.DataInsight}'
            AND published = TRUE
            AND publishedAt <= NOW()
        ORDER BY publishedAt DESC
        LIMIT ?`,
        [limit]
    ).then((results) =>
        results.map((record: any) => ({
            ...record,
            index: Number(record.index),
            authors: JSON.parse(record.authors),
        }))
    ) as Promise<MinimalDataInsightInterface[]>
}

export const getPublishedDataInsightCount = (
    knex: KnexReadonlyTransaction
): Promise<number> => {
    return knexRawFirst<{ count: number }>(
        knex,
        `
        SELECT COUNT(*) AS count
        FROM posts_gdocs
        WHERE type = '${OwidGdocType.DataInsight}'
            AND published = TRUE
            AND publishedAt <= NOW()`
    ).then((res) => res?.count ?? 0)
}

export const getTotalNumberOfCharts = (
    knex: KnexReadonlyTransaction
): Promise<number> => {
    return knexRawFirst<{ count: number }>(
        knex,
        `
        SELECT COUNT(*) AS count
        FROM charts
        WHERE config->"$.isPublished" = TRUE`
    ).then((res) => res?.count ?? 0)
}

export const getTotalNumberOfInUseGrapherTags = (
    knex: KnexReadonlyTransaction
): Promise<number> => {
    return knexRawFirst<{ count: number }>(
        knex,
        `
        SELECT COUNT(DISTINCT(tagId)) AS count
        FROM chart_tags
        WHERE chartId IN (
        SELECT id
        FROM charts
        WHERE publishedAt IS NOT NULL)`
    ).then((res) => res?.count ?? 0)
}

/**
 * For usage with GdocFactory.load, until we refactor Gdocs to be entirely Knex-based.
 */
export const getHomepageId = (
    knex: KnexReadonlyTransaction
): Promise<string | undefined> => {
    return knexRawFirst<{ id: string }>(
        knex,
        `-- sql
        SELECT
            posts_gdocs.id
        FROM
            posts_gdocs
        WHERE
            type = '${OwidGdocType.Homepage}'
            AND published = TRUE`
    ).then((result) => result?.id)
}

export const getImageMetadataByFilenames = async (
    knex: KnexReadonlyTransaction,
    filenames: string[]
): Promise<Record<string, ImageMetadata & { id: number }>> => {
    if (filenames.length === 0) return {}
    const rows = await knexRaw<ImageMetadata & { id: number }>(
        knex,
        `-- sql
        SELECT
            id,
            googleId,
            filename,
            defaultAlt,
            updatedAt,
            originalWidth,
            originalHeight
        FROM
            images
        WHERE filename IN (?)`,
        [filenames]
    )
    return keyBy(rows, "filename")
}

export const getPublishedGdocPosts = async (
    knex: KnexReadonlyTransaction
): Promise<DbEnrichedPostGdoc[]> => {
    return knexRaw<DbRawPostGdoc>(
        knex,
        `-- sql
        SELECT
        g.breadcrumbs,
        g.content,
        g.createdAt,
        g.id,
        g.markdown,
        g.publicationContext,
        g.published,
        g.publishedAt,
        g.revisionId,
        g.slug,
        g.updatedAt
    FROM
        posts_gdocs g
    WHERE
        g.published = 1
        AND g.type IN (:types)
        AND g.publishedAt <= NOW()
    ORDER BY g.publishedAt DESC`,
        {
            types: [
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.AboutPage,
            ],
        }
    ).then((rows) => rows.map(parsePostsGdocsRow))
}

export const getPublishedGdocPostsWithTags = async (
    knex: KnexReadonlyTransaction
): Promise<DBEnrichedPostGdocWithTags[]> => {
    return knexRaw<DBRawPostGdocWithTags>(
        knex,
        `-- sql
        SELECT
        g.breadcrumbs,
        g.content,
        g.createdAt,
        g.id,
        g.markdown,
        g.publicationContext,
        g.published,
        g.publishedAt,
        g.revisionId,
        g.slug,
        g.updatedAt,
        if( COUNT(t.id) = 0, JSON_ARRAY(), JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', t.id,
              'name', t.name,
              'slug', t.slug
          ))) AS tags
    FROM
        posts_gdocs g
    LEFT JOIN posts_gdocs_x_tags gxt ON
        g.id = gxt.gdocId
    LEFT JOIN tags t ON
        gxt.tagId = t.id
    WHERE
        g.published = 1
        AND g.type IN (:types)
        AND g.publishedAt <= NOW()
    GROUP BY g.id
    ORDER BY g.publishedAt DESC`,
        {
            types: [
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.AboutPage,
            ],
        }
    ).then((rows) => rows.map(parsePostsGdocsWithTagsRow))
}

export const getNonGrapherExplorerViewCount = (
    knex: KnexReadonlyTransaction
): Promise<number> => {
    return knexRawFirst<{ count: number }>(
        knex,
        `-- sql
        SELECT
            COUNT(*) as count
        FROM
            explorers,
            json_table(config, "$.blocks[*]"
                COLUMNS (
                    type TEXT PATH "$.type",
                    NESTED PATH "$.block[*]"
                        COLUMNS (grapherId INT PATH "$.grapherId")
                    )
            ) t1
        WHERE
            isPublished = 1
            AND type = "graphers"
            AND grapherId IS NULL`
    ).then((res) => res?.count ?? 0)
}

/**
 * 1. Fetch all records in tag_graph, isTopic = true when there is a published TP/LTP/Article with the same slug as the tag
 * 2. Group tags by their parentId
 * 3. Return the flat tag graph along with a __rootId property so that the UI knows which record is the root node
 */
export async function getFlatTagGraph(knex: KnexReadonlyTransaction): Promise<
    FlatTagGraph & {
        __rootId: number
    }
> {
    const tagGraphByParentId = await knexRaw<FlatTagGraphNode>(
        knex,
        `-- sql
        SELECT
            tg.parentId,
            tg.childId,
            tg.weight,
            t.name,
            p.slug IS NOT NULL AS isTopic
        FROM
            tag_graph tg
        LEFT JOIN tags t ON
            tg.childId = t.id
        LEFT JOIN posts_gdocs p ON
            t.slug = p.slug AND p.published = 1 AND p.type IN (:types)
        -- order by descending weight, tiebreak by name
        ORDER BY tg.weight DESC, t.name ASC`,
        {
            types: [
                OwidGdocType.TopicPage,
                OwidGdocType.LinearTopicPage,
                // For sub-topics e.g. Nuclear Energy we use the article format
                OwidGdocType.Article,
            ],
        }
    ).then((rows) => groupBy(rows, "parentId"))

    const tagGraphRootIdResult = await knexRawFirst<{
        id: number
    }>(
        knex,
        `-- sql
        SELECT id FROM tags WHERE name = "${TagGraphRootName}"`
    )
    if (!tagGraphRootIdResult) throw new Error("Tag graph root not found")

    return { ...tagGraphByParentId, __rootId: tagGraphRootIdResult.id }
}

export async function updateTagGraph(
    knex: KnexReadWriteTransaction,
    tagGraph: FlatTagGraph
): Promise<void> {
    const tagGraphRows: {
        parentId: number
        childId: number
        weight: number
    }[] = []

    for (const children of Object.values(tagGraph)) {
        for (const child of children) {
            tagGraphRows.push({
                parentId: child.parentId,
                childId: child.childId,
                weight: child.weight,
            })
        }
    }

    const existingTagGraphRows = await knexRaw<{
        parentId: number
        childId: number
        weight: number
    }>(
        knex,
        `-- sql
        SELECT parentId, childId, weight FROM tag_graph
    `
    )
    // Remove rows that are not in the new tag graph
    // Add rows that are in the new tag graph but not in the existing tag graph
    const rowsToDelete = existingTagGraphRows.filter(
        (row) =>
            !tagGraphRows.some(
                (newRow) =>
                    newRow.parentId === row.parentId &&
                    newRow.childId === row.childId &&
                    newRow.weight === row.weight
            )
    )
    const rowsToAdd = tagGraphRows.filter(
        (newRow) =>
            !existingTagGraphRows.some(
                (row) =>
                    newRow.parentId === row.parentId &&
                    newRow.childId === row.childId &&
                    newRow.weight === row.weight
            )
    )

    if (rowsToDelete.length > 0) {
        await knexRaw(
            knex,
            `-- sql
            DELETE FROM tag_graph
            WHERE parentId IN (?)
            AND childId IN (?)
            AND weight IN (?)
        `,
            [
                rowsToDelete.map((row) => row.parentId),
                rowsToDelete.map((row) => row.childId),
                rowsToDelete.map((row) => row.weight),
            ]
        )
    }

    if (rowsToAdd.length > 0) {
        await knexRaw(
            knex,
            `-- sql
            INSERT INTO tag_graph (parentId, childId, weight)
            VALUES ?
        `,
            [rowsToAdd.map((row) => [row.parentId, row.childId, row.weight])]
        )
    }
}

export function getMinimalTagsWithIsTopic(
    knex: KnexReadonlyTransaction
): Promise<MinimalTagWithIsTopic[]> {
    return knexRaw<MinimalTagWithIsTopic>(
        knex,
        `-- sql
        SELECT t.id,
        t.name,
        t.slug,
        t.slug IS NOT NULL AND MAX(IF(pg.type IN (:types), TRUE, FALSE)) AS isTopic
        FROM tags t
        LEFT JOIN posts_gdocs_x_tags gt ON t.id = gt.tagId
        LEFT JOIN posts_gdocs pg ON gt.gdocId = pg.id
        GROUP BY t.id, t.name
        ORDER BY t.name ASC
    `,
        {
            types: [
                OwidGdocType.TopicPage,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.Article,
            ],
        }
    )
}
