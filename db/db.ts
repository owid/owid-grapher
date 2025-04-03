import { knex, Knex } from "knex"
import {
    GRAPHER_DB_HOST,
    GRAPHER_DB_USER,
    GRAPHER_DB_PASS,
    GRAPHER_DB_NAME,
    GRAPHER_DB_PORT,
    BAKED_BASE_URL,
} from "../settings/serverSettings.js"
import { registerExitHandler } from "./cleanup.js"
import { createTagGraph, keyBy } from "@ourworldindata/utils"
import {
    ImageMetadata,
    MinimalDataInsightInterface,
    OwidGdocType,
    DBRawPostGdocWithTags,
    parsePostsGdocsWithTagsRow,
    DBEnrichedPostGdocWithTags,
    parsePostsGdocsRow,
    TagGraphRootName,
    FlatTagGraph,
    FlatTagGraphNode,
    MinimalTagWithIsTopic,
    DbPlainPostGdocLink,
    OwidGdocLinkType,
    OwidGdoc,
    DbPlainTag,
    TagGraphNode,
    MinimalExplorerInfo,
    DbEnrichedImage,
    DbEnrichedImageWithUserId,
    MinimalTag,
    BreadcrumbItem,
    PostsGdocsTableName,
    OwidGdocBaseInterface,
    TagGraphRoot,
} from "@ourworldindata/types"
import { groupBy } from "lodash"
import { gdocFromJSON } from "./model/Gdoc/GdocFactory.js"
import { getCanonicalUrl } from "@ourworldindata/components"

// Return the first match from a mysql query
export const closeTypeOrmAndKnexConnections = async (): Promise<void> => {
    if (_knexInstance) {
        await _knexInstance.destroy()
        _knexInstance = undefined
    }
}

let _knexInstance: Knex | undefined = undefined

export function setKnexInstance(knexInstance: Knex<any, any[]>): void {
    _knexInstance = knexInstance
}

const getNewKnexInstance = (): Knex<any, any[]> => {
    return knex({
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
}

export const knexInstance = (): Knex<any, any[]> => {
    if (_knexInstance) return _knexInstance

    _knexInstance = getNewKnexInstance()

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
 *  baking them from the wordpress post. This function fetches all the slugs of posts that have been published via gdocs,
 *  to help us exclude them from the baking process. This query used to rely on the gdocSuccessorId field but that fell out of sync.
 */
export const getSlugsWithPublishedGdocsSuccessors = async (
    knex: KnexReadonlyTransaction
): Promise<Set<string>> => {
    return knexRaw(
        knex,
        `-- sql
        SELECT
            p.slug
        FROM
            posts p
        LEFT JOIN posts_gdocs g on
            p.slug = g.slug
        WHERE
            p.status = "publish"
            AND g.published = TRUE
    `
    ).then((rows) => new Set(rows.map((row: any) => row.slug)))
}

export const getExplorerTags = async (
    knex: KnexReadonlyTransaction
): Promise<{ slug: string; tags: Pick<DbPlainTag, "name" | "id">[] }[]> => {
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
            tags: JSON.parse(row.tags) as Pick<DbPlainTag, "name" | "id">[],
        }))
    )
}

export const getPublishedExplorersBySlug = async (
    knex: KnexReadonlyTransaction
): Promise<Record<string, MinimalExplorerInfo>> => {
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
            const tagsForExplorer = tagsBySlug[row.slug]
            return {
                slug: row.slug,
                title: row.title,
                subtitle: row.subtitle === "null" ? "" : row.subtitle,
                tags: tagsForExplorer
                    ? tagsForExplorer.tags.map((tag) => tag.name)
                    : [],
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
            authors,
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

export async function checkIfSlugCollides(
    knex: KnexReadonlyTransaction,
    gdoc: OwidGdocBaseInterface
): Promise<boolean> {
    const existingGdoc = await knex(PostsGdocsTableName)
        .where({
            slug: gdoc.slug,
            published: true,
        })
        .whereNot({
            id: gdoc.id,
        })
        .first()
        .then((row) => (row ? parsePostsGdocsRow(row) : undefined))

    if (!existingGdoc) return false

    const existingCanonicalUrl = getCanonicalUrl("", existingGdoc)
    const incomingCanonicalUrl = getCanonicalUrl("", gdoc)

    return existingCanonicalUrl === incomingCanonicalUrl
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
        `-- sql
            SELECT COUNT(*) AS count
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE cc.full ->> "$.isPublished" = "true"
        `
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

export async function checkIsImageInDB(
    trx: KnexReadonlyTransaction,
    filename: string
): Promise<boolean> {
    const image = await trx("images").where("filename", filename).first()
    return !!image
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
            filename,
            defaultAlt,
            updatedAt,
            originalWidth,
            originalHeight,
            cloudflareId
        FROM
            images
        WHERE filename IN (?)
        AND replacedBy IS NULL`,
        [filenames]
    )
    return keyBy(rows, "filename")
}

export const getPublishedGdocsWithTags = async (
    knex: KnexReadonlyTransaction,
    // The traditional "post" types - doesn't include data insights, author pages, the homepage, etc.
    gdocTypes: OwidGdocType[] = [
        OwidGdocType.Article,
        OwidGdocType.LinearTopicPage,
        OwidGdocType.TopicPage,
        OwidGdocType.AboutPage,
    ]
): Promise<DBEnrichedPostGdocWithTags[]> => {
    return knexRaw<DBRawPostGdocWithTags>(
        knex,
        `-- sql
        SELECT
        g.manualBreadcrumbs,
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
        AND g.type IN (:gdocTypes)
        AND g.publishedAt <= NOW()
    GROUP BY g.id
    ORDER BY g.publishedAt DESC`,
        {
            gdocTypes,
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
            t.slug,
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

// DFS through the tag graph and track all paths from a child to the root
// e.g. { "childTag": [ [parentTag1, parentTag2], [parentTag3] ] }
// Use this with getUniqueNamesFromParentTagArrays to get Record<string, string[]> instead
export async function getParentTagArraysByChildName(
    trx: KnexReadonlyTransaction
): Promise<
    Record<DbPlainTag["name"], Pick<DbPlainTag, "id" | "name" | "slug">[][]>
> {
    const { __rootId, ...flatTagGraph } = await getFlatTagGraph(trx)
    const tagGraph = createTagGraph(flatTagGraph, __rootId)
    const tagsById = await trx<DbPlainTag>("tags")
        .select("id", "name", "slug")
        .then((tags) => keyBy(tags, "id"))

    const pathsByChildName: Record<
        DbPlainTag["name"],
        Pick<DbPlainTag, "id" | "name" | "slug">[][]
    > = {}

    function trackAllPaths(
        node: TagGraphNode,
        currentPath: Pick<DbPlainTag, "id" | "name" | "slug">[] = []
    ): void {
        const currentTag = tagsById[node.id]
        const newPath = [...currentPath, currentTag]

        // Don't add paths for root node
        if (node.id !== __rootId) {
            const nodeName = currentTag.name
            if (!pathsByChildName[nodeName]) {
                pathsByChildName[nodeName] = []
            }

            // Add the complete path (excluding root)
            pathsByChildName[nodeName].push(newPath.slice(1))
        }

        for (const child of node.children) {
            trackAllPaths(child, newPath)
        }
    }

    trackAllPaths(tagGraph)

    return pathsByChildName
}

export function getBestBreadcrumbs(
    tags: MinimalTag[],
    parentTagArraysByChildName: Record<
        string,
        Pick<DbPlainTag, "id" | "name" | "slug">[][]
    >
): BreadcrumbItem[] {
    // For each tag, find the best path according to our criteria
    // e.g. { "Nuclear Energy ": ["Energy and Environment", "Energy"], "Air Pollution": ["Energy and Environment"] }
    const result = new Map<number, Pick<DbPlainTag, "id" | "name" | "slug">[]>()

    for (const tag of tags) {
        const paths = parentTagArraysByChildName[tag.name]
        if (paths && paths.length > 0) {
            // Since getFlatTagGraph already orders by weight DESC and name ASC,
            // the first path in the array will be our best path
            result.set(tag.id, paths[0])
        }
    }

    // Only keep the topics in the paths, because only topics are clickable as breadcrumbs
    const topicsOnly = Array.from(result.values()).reduce(
        (acc, path) => {
            return [...acc, path.filter((tag) => tag.slug)]
        },
        [] as Pick<DbPlainTag, "id" | "name" | "slug">[][]
    )

    // Pick the longest path from result, assuming that the longest path is the best
    const longestPath = topicsOnly.reduce((best, path) => {
        return path.length > best.length ? path : best
    }, [])

    const breadcrumbs = longestPath.map((tag) => ({
        label: tag.name,
        href: `${BAKED_BASE_URL}/${tag.slug}`,
    }))

    return breadcrumbs
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

export async function getGrapherLinkTargets(
    knex: KnexReadonlyTransaction
): Promise<Pick<DbPlainPostGdocLink, "target">[]> {
    return knexRaw<Pick<DbPlainPostGdocLink, "target">>(
        knex,
        `-- sql
        SELECT target
        FROM posts_gdocs_links
        WHERE linkType = '${OwidGdocLinkType.Grapher}'
        `
    )
}

/**
 * Get the slugs of all datapages that are linked to in KeyIndicator blocks
 * Optionally exclude homepage KeyIndicator blocks, because for prefetching (the one current usecase for this function)
 * the SiteBaker fetches the indicator metadata separately
 */
export async function getLinkedIndicatorSlugs({
    knex,
    excludeHomepage = false,
}: {
    knex: KnexReadonlyTransaction
    excludeHomepage: boolean
}): Promise<Set<string>> {
    let rawQuery = `-- sql
        SELECT * FROM posts_gdocs WHERE published = TRUE`
    if (excludeHomepage) {
        rawQuery += ` AND type != '${OwidGdocType.Homepage}'`
    }
    return knexRaw<OwidGdoc>(knex, rawQuery)
        .then((gdocs) => gdocs.map((gdoc) => gdocFromJSON(gdoc)))
        .then((gdocs) => gdocs.flatMap((gdoc) => gdoc.linkedKeyIndicatorSlugs))
        .then((slugs) => new Set(slugs))
}

export async function selectReplacementChainForImage(
    trx: KnexReadonlyTransaction,
    id: string
): Promise<DbEnrichedImage[]> {
    return knexRaw<DbEnrichedImage>(
        trx,
        `-- sql
        WITH RECURSIVE replacement_chain AS (
            SELECT i.*
            FROM images i
            WHERE id = ?
        
            UNION ALL
        
            SELECT i.*
            FROM images i
            INNER JOIN replacement_chain rc ON i.replacedBy = rc.id
        )
        SELECT * FROM replacement_chain
        `,
        [id]
    )
}

export function getCloudflareImages(
    trx: KnexReadonlyTransaction
): Promise<DbEnrichedImage[]> {
    return knexRaw<DbEnrichedImage>(
        trx,
        `-- sql
        SELECT *
        FROM images
        WHERE cloudflareId IS NOT NULL
        AND replacedBy IS NULL`
    )
}

export function getCloudflareImage(
    trx: KnexReadonlyTransaction,
    filename: string
): Promise<DbEnrichedImageWithUserId | undefined> {
    return knexRawFirst(
        trx,
        `-- sql
        SELECT * 
        FROM images
        WHERE filename = ?
        AND replacedBy IS NULL`,
        [filename]
    )
}

/**
 * Get the title, slug, and googleId of all gdocs that reference each image
 */
export function getImageUsage(trx: KnexReadonlyTransaction): Promise<
    Record<
        number,
        {
            title: string
            id: string
        }[]
    >
> {
    return knexRaw<{
        imageId: number
        posts: string
    }>(
        trx,
        `-- sql
        SELECT 
        i.id as imageId,
        JSON_ARRAYAGG(
            JSON_OBJECT(
            'title', p.content->>'$.title',
            'id', p.id
            )
        ) as posts  
        FROM posts_gdocs p
        JOIN posts_gdocs_x_images pi ON p.id = pi.gdocId 
        JOIN images i ON pi.imageId = i.id
        WHERE i.replacedBy IS NULL
        GROUP BY i.id`
    ).then((results) =>
        Object.fromEntries(
            results.map((result) => [result.imageId, JSON.parse(result.posts)])
        )
    )
}

// A topic is any tag that has a slug matching the slug of a published topic page, linear topic page, or article.
// We want to keep tags that have topic children (i.e. areas and sub-areas) but not leaf nodes that aren't topics
function checkDoesFlatTagGraphNodeHaveAnyTopicChildren(
    node: FlatTagGraphNode,
    flatTagGraph: FlatTagGraph
): boolean {
    if (node.isTopic) return true
    const children = flatTagGraph[node.childId]
    if (!children) return false
    return children.some((child) =>
        checkDoesFlatTagGraphNodeHaveAnyTopicChildren(child, flatTagGraph)
    )
}

export async function generateTopicTagGraph(
    knex: KnexReadonlyTransaction
): Promise<TagGraphRoot> {
    const { __rootId, ...parents } = await getFlatTagGraph(knex)

    const tagGraphTopicsOnly = Object.entries(parents).reduce(
        (acc: FlatTagGraph, [parentId, children]) => {
            acc[Number(parentId)] = children.filter((child) => {
                if (child.parentId === __rootId) return true
                return checkDoesFlatTagGraphNodeHaveAnyTopicChildren(
                    child,
                    parents
                )
            })
            return acc
        },
        {} as FlatTagGraph
    )

    return createTagGraph(tagGraphTopicsOnly, __rootId)
}

export const getUniqueTopicCount = async (
    trx: KnexReadonlyTransaction
): Promise<number> => {
    const count = await knexRawFirst<{ count: number }>(
        trx,
        `-- sql
        SELECT COUNT(DISTINCT(t.slug)) AS count
        FROM tags t
        LEFT JOIN posts_gdocs p ON t.slug = p.slug
        WHERE t.slug IS NOT NULL AND p.published IS true
        AND p.type IN (:types)`,
        {
            types: [
                OwidGdocType.TopicPage,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.Article,
            ],
        }
    )
        .then((res) => (res ? res.count : 0))
        .catch((e) => {
            console.error("Failed to get unique topic count", e)
            throw e
        })
    // throw on count == 0 also
    if (!count) throw new Error("Failed to get unique topic count")
    return count
}
