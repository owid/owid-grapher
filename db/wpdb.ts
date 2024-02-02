import { DatabaseConnection } from "./DatabaseConnection.js"
import {
    WORDPRESS_DB_NAME,
    WORDPRESS_DB_HOST,
    WORDPRESS_DB_PORT,
    WORDPRESS_DB_USER,
    WORDPRESS_DB_PASS,
    WORDPRESS_API_PASS,
    WORDPRESS_API_USER,
    WORDPRESS_URL,
} from "../settings/serverSettings.js"
import * as db from "./db.js"
import { Knex, knex } from "knex"
import { Base64 } from "js-base64"
import { registerExitHandler } from "./cleanup.js"
import {
    RelatedChart,
    WP_PostType,
    DocumentNode,
    PostReference,
    JsonError,
    PostRestApi,
    TopicId,
    GraphType,
    uniqBy,
    sortBy,
    DataPageRelatedResearch,
    OwidGdocType,
    Tag,
} from "@ourworldindata/utils"
import { OwidGdocLinkType, Topic } from "@ourworldindata/types"
import {
    getContentGraph,
    WPPostTypeToGraphDocumentType,
} from "./contentGraph.js"
import { TOPICS_CONTENT_GRAPH } from "../settings/clientSettings.js"
import { Link } from "./model/Link.js"

let _knexInstance: Knex

export const isWordpressAPIEnabled = WORDPRESS_URL.length > 0
export const isWordpressDBEnabled = WORDPRESS_DB_NAME.length > 0

class WPDB {
    private conn?: DatabaseConnection

    private knexInstance(
        tableName?: string | Knex.Raw | Knex.QueryBuilder | undefined
    ): Knex.QueryBuilder {
        if (!_knexInstance) {
            _knexInstance = knex({
                client: "mysql",
                connection: {
                    host: WORDPRESS_DB_HOST,
                    port: WORDPRESS_DB_PORT,
                    user: WORDPRESS_DB_USER,
                    password: WORDPRESS_DB_PASS,
                    database: WORDPRESS_DB_NAME,
                },
            })

            registerExitHandler(async () => this.destroyKnex())
        }

        return _knexInstance(tableName)
    }

    private async destroyKnex(): Promise<void> {
        if (_knexInstance) await _knexInstance.destroy()
    }

    async connect(): Promise<void> {
        this.conn = new DatabaseConnection({
            host: WORDPRESS_DB_HOST,
            port: WORDPRESS_DB_PORT,
            user: WORDPRESS_DB_USER,
            password: WORDPRESS_DB_PASS,
            database: WORDPRESS_DB_NAME,
        })
        await this.conn.connect()

        registerExitHandler(async () => {
            if (this.conn) this.conn.end()
        })
    }

    async end(): Promise<void> {
        if (this.conn) this.conn.end()
        this.destroyKnex()
    }

    async query(queryStr: string, params?: any[]): Promise<any[]> {
        if (!this.conn) await this.connect()

        return this.conn!.query(queryStr, params)
    }

    async get(queryStr: string, params?: any[]): Promise<any> {
        if (!this.conn) await this.connect()

        return this.conn!.get(queryStr, params)
    }
}

export const singleton = new WPDB()

export const WP_API_ENDPOINT = `${WORDPRESS_URL}/wp-json/wp/v2`
export const OWID_API_ENDPOINT = `${WORDPRESS_URL}/wp-json/owid/v1`
export const WP_GRAPHQL_ENDPOINT = `${WORDPRESS_URL}/wp/graphql`

export const ENTRIES_CATEGORY_ID = 44

/* Wordpress GraphQL API query
 *
 * Note: in contrast to the REST API query, the GraphQL query does not throw when a
 * resource is not found, as GraphQL returns a 200, with a shape that is different between
 * every query. So it is the caller's responsibility to throw (if necessary) on
 * "faux 404".
 */
const graphqlQuery = async (
    query: string,
    variables: any = {}
): Promise<any> => {
    const response = await fetch(WP_GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Basic ${Base64.encode(
                WORDPRESS_API_USER + ":" + WORDPRESS_API_PASS
            )}`,
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    })
    return response.json()
}

/* Wordpress REST API query
 *
 * Note: throws on response.status >= 200 && response.status < 300.
 */
export const apiQuery = async (
    endpoint: string,
    params?: {
        returnResponseHeadersOnly?: boolean
        searchParams?: Array<[string, string | number]>
    }
): Promise<any> => {
    const url = new URL(endpoint)

    if (params && params.searchParams) {
        params.searchParams.forEach((param) => {
            url.searchParams.append(param[0], String(param[1]))
        })
    }
    const response = await fetch(url.toString(), {
        headers: {
            Authorization: `Basic ${Base64.encode(
                WORDPRESS_API_USER + ":" + WORDPRESS_API_PASS
            )}`,
            Accept: "application/json",
        },
    })

    if (!response.ok)
        throw new JsonError(
            `HTTP Error Response: ${response.status} ${response.statusText}`
        )

    return params && params.returnResponseHeadersOnly
        ? response.headers
        : response.json()
}

export const getDocumentsInfo = async (
    type: WP_PostType,
    cursor: string = "",
    where: string = ""
): Promise<DocumentNode[]> => {
    const typePlural = `${type}s`
    const query = `
    query($cursor: String){
        ${typePlural}(first:50, after: $cursor, where:{${where}}) {
            pageInfo {
                hasNextPage
                endCursor
            }
            nodes {
                id: databaseId
                title
                slug
                type: __typename
                content
                image: featuredImage {
                    node {
                        sourceUrl
                    }
                }
                ${
                    TOPICS_CONTENT_GRAPH
                        ? `
                parentTopics {
                    nodes {
                        id: databaseId
                    }
                }

                `
                        : ""
                }
            }
        }
    }
    `

    const result = await graphqlQuery(query, { cursor })
    if (!result.data) return []

    const pageInfo = result.data[typePlural].pageInfo
    const nodes: Array<
        Omit<DocumentNode, "image" | "parentTopics"> & {
            image: { node: { sourceUrl: string } } | null
            parentTopics?: { nodes: { id: TopicId }[] }
        }
    > = result.data[typePlural].nodes
    const documents = nodes.map((node) => ({
        ...node,
        type: WPPostTypeToGraphDocumentType[type.toLowerCase() as WP_PostType],
        image: node.image?.node.sourceUrl ?? null,
        parentTopics: node.parentTopics?.nodes.map((topic) => topic.id) ?? [],
    }))
    if (pageInfo.hasNextPage) {
        return documents.concat(
            await getDocumentsInfo(type, pageInfo.endCursor, where)
        )
    } else {
        return documents
    }
}

export const getPermalinks = async (): Promise<{
    // Strip trailing slashes, and convert __ into / to allow custom subdirs like /about/media-coverage
    get: (ID: number, postName: string) => string
}> => ({
    // Strip trailing slashes, and convert __ into / to allow custom subdirs like /about/media-coverage
    get: (ID: number, postName: string): string =>
        postName.replace(/\/+$/g, "").replace(/--/g, "/").replace(/__/g, "/"),
})

// page => pages, post => posts
export const getEndpointSlugFromType = (type: string): string => `${type}s`

// The API query in getPostType is cleaner but slower, which becomes more of an
// issue with prominent links requesting posts by slugs (getPostBySlug) to
// render (of which getPostType is a callee).

// Attention: slugs but also paths are not always unique. Not sure how this
// makes sense but it is possible to create a page and a post with the same
// path. Where it makes sense: if a page page had a parent page, then the path
// becomes /parent/current-page, which avoid conflicts with posts registering
// paths at the root (e.g /current-page). However pages don't have to have a
// parent, so they may also register paths at the root level, and conflict with
// posts (see
// https://developer.wordpress.org/reference/functions/wp_unique_post_slug/)
// This is particularly problematic in our setup where hierarchical paths are
// not supported which means pages and posts are in direct competition for root
// paths. So authors need to be diligent when creating paths to make sure pages
// and posts paths don't collide. This is not enforced at the application level.
export const getPostIdAndTypeBySlug = async (
    slug: string
): Promise<{ id: number; type: string } | undefined> => {
    const rows = await singleton.query(
        "SELECT ID, post_type FROM wp_posts WHERE `post_name` = ? AND post_type IN ( ? )",
        [slug, [WP_PostType.Post, WP_PostType.Page]]
    )

    if (!rows.length) return

    return { id: rows[0].ID, type: rows[0].post_type }
}

export const getPostApiBySlugFromApi = async (
    slug: string
): Promise<PostRestApi> => {
    if (!isWordpressAPIEnabled) {
        throw new JsonError(`Need wordpress API to match slug ${slug}`, 404)
    }

    const postIdAndType = await getPostIdAndTypeBySlug(slug)
    if (!postIdAndType)
        throw new JsonError(`No page found by slug ${slug}`, 404)

    const { id, type } = postIdAndType

    return apiQuery(`${WP_API_ENDPOINT}/${getEndpointSlugFromType(type)}/${id}`)
}

export const getPostTags = async (
    postId: number
): Promise<Pick<Tag, "id" | "name">[]> => {
    return await db
        .knexTable("post_tags")
        .select("tags.id", "tags.name")
        .where({ post_id: postId })
        .join("tags", "tags.id", "=", "post_tags.tag_id")
}

export const getRelatedChartsForVariable = async (
    variableId: number,
    chartIdsToExclude: number[] = []
): Promise<RelatedChart[]> => {
    const excludeChartIds =
        chartIdsToExclude.length > 0
            ? `AND charts.id NOT IN (${chartIdsToExclude.join(", ")})`
            : ""

    return db.queryMysql(`-- sql
                SELECT
                    charts.config->>"$.slug" AS slug,
                    charts.config->>"$.title" AS title,
                    charts.config->>"$.variantName" AS variantName,
                    MAX(chart_tags.keyChartLevel) as keyChartLevel
                FROM charts
                INNER JOIN chart_tags ON charts.id=chart_tags.chartId
                WHERE JSON_CONTAINS(config->'$.dimensions', '{"variableId":${variableId}}')
                AND charts.config->>"$.isPublished" = "true"
                ${excludeChartIds}
                GROUP BY charts.id
                ORDER BY title ASC
            `)
}

interface RelatedResearchQueryResult {
    linkTargetSlug: string
    componentType: string
    chartSlug: string
    title: string
    postSlug: string
    chartId: number
    authors: string
    thumbnail: string
    pageviews: number
    post_source: string
    tags: string
}
export const getRelatedResearchAndWritingForVariable = async (
    variableId: number
): Promise<DataPageRelatedResearch[]> => {
    const wp_posts: RelatedResearchQueryResult[] = await db.queryMysql(
        `-- sql
            -- What we want here is to get from the variable to the charts
            -- to the posts and collect different pieces of information along the way
            -- One important complication is that the slugs that are used in posts to
            -- embed charts can either be the current slugs or old slugs that are redirected
            -- now.
            select
                distinct
                pl.target as linkTargetSlug,
                pl.componentType as componentType,
                coalesce(csr.slug, c.slug) as chartSlug,
                p.title as title,
                p.slug as postSlug,
                coalesce(csr.chart_id, c.id) as chartId,
                p.authors as authors,
                p.featured_image as thumbnail,
                coalesce(pv.views_365d, 0) as pageviews,
                'wordpress' as post_source,
                (select coalesce(JSON_ARRAYAGG(t.name), JSON_ARRAY())
                    from post_tags pt
                    join tags t on pt.tag_id = t.id
                    where pt.post_id = p.id
                ) as tags
            from
                posts_links pl
            join posts p on
                pl.sourceId = p.id
            left join charts c on
                pl.target = c.slug
            left join chart_slug_redirects csr on
                pl.target = csr.slug
            left join chart_dimensions cd on
                cd.chartId = coalesce(csr.chart_id, c.id)
            left join analytics_pageviews pv on
                pv.url = concat('https://ourworldindata.org/', p.slug )
            left join posts_gdocs pg on
            	pg.id = p.gdocSuccessorId
            left join posts_gdocs pgs on
                pgs.slug = p.slug
            left join post_tags pt on
                pt.post_id = p.id
            where
                -- we want only urls that point to grapher charts
                pl.linkType = 'grapher'
                -- componentType src is for those links that matched the anySrcregex (not anyHrefRegex or prominentLinkRegex)
                -- this means that only the links that are of the iframe kind will be kept - normal a href style links will
                -- be disregarded
                and componentType = 'src'
                and cd.variableId = ?
                and cd.property in ('x', 'y') -- ignore cases where the indicator is size, color etc
                and p.status = 'publish' -- only use published wp posts
                and p.type != 'wp_block'
                and coalesce(pg.published, 0) = 0 -- ignore posts if the wp post has a published gdoc successor. The
                                                  -- coalesce makes sure that if there is no gdoc successor then
                                                  -- the filter keeps the post
                and coalesce(pgs.published, 0) = 0 -- ignore posts if there is a gdoc post with the same slug that is published
                      -- this case happens for example for topic pages that are newly created (successorId is null)
                      -- but that replace an old wordpress page

            `,
        [variableId]
    )

    const gdocs_posts: RelatedResearchQueryResult[] = await db.queryMysql(
        `-- sql
            select
                distinct
                pl.target as linkTargetSlug,
                pl.componentType as componentType,
                coalesce(csr.slug, c.slug) as chartSlug,
                p.content ->> '$.title' as title,
                p.slug as postSlug,
                coalesce(csr.chart_id, c.id) as chartId,
                p.content ->> '$.authors' as authors,
                p.content ->> '$."featured-image"' as thumbnail,
                coalesce(pv.views_365d, 0) as pageviews,
                'gdocs' as post_source,
                (select coalesce(JSON_ARRAYAGG(t.name), JSON_ARRAY())
                    from posts_gdocs_x_tags pt
                    join tags t on pt.tagId = t.id
                    where pt.gdocId = p.id
                ) as tags
            from
                posts_gdocs_links pl
            join posts_gdocs p on
                pl.sourceId = p.id
            left join charts c on
                pl.target = c.slug
            left join chart_slug_redirects csr on
                pl.target = csr.slug
            join chart_dimensions cd on
                cd.chartId = coalesce(csr.chart_id, c.id)
            left join analytics_pageviews pv on
                pv.url = concat('https://ourworldindata.org/', p.slug )
            left join posts_gdocs_x_tags pt on
                pt.gdocId = p.id
            where
                pl.linkType = 'grapher'
                and componentType = 'chart' -- this filters out links in tags and keeps only embedded charts
                and cd.variableId = ?
                and cd.property in ('x', 'y') -- ignore cases where the indicator is size, color etc
                and p.published = 1
                and p.content ->> '$.type' != 'fragment'`,
        [variableId]
    )

    const combined = [...wp_posts, ...gdocs_posts]

    // we could do the sorting in the SQL query if we'd union the two queries
    // but it seemed easier to understand if we do the sort here
    const sorted = sortBy(combined, (post) => -post.pageviews)

    const allSortedRelatedResearch = sorted.map((post) => {
        const parsedAuthors = JSON.parse(post.authors)
        const parsedTags = post.tags !== "" ? JSON.parse(post.tags) : []

        return {
            title: post.title,
            url: `/${post.postSlug}`,
            variantName: "",
            authors: parsedAuthors,
            imageUrl: post.thumbnail,
            tags: parsedTags,
        }
    })
    // the queries above use distinct but because of the information we pull in if the same piece of research
    // uses different charts that all use a single indicator we would get duplicates for the post to link to so
    // here we deduplicate by url. The first item is retained by uniqBy, latter ones are discarded.
    return uniqBy(allSortedRelatedResearch, "url")
}

export const getRelatedArticles = async (
    chartId: number
): Promise<PostReference[] | undefined> => {
    const graph = await getContentGraph()

    const chartRecord = await graph.find(GraphType.Chart, chartId)

    if (!chartRecord.payload.count) return

    const chart = chartRecord.payload.records[0]
    const publishedLinksToChart = await Link.getPublishedLinksTo(
        [chart.slug],
        OwidGdocLinkType.Grapher
    )
    const publishedGdocPostsThatReferenceChart: PostReference[] =
        publishedLinksToChart
            .filter(
                (link) => link.source.content.type !== OwidGdocType.Fragment
            )
            .map((link) => ({
                id: link.source.id,
                title: link.source.content.title!,
                slug: link.source.slug,
            }))
    const relatedArticles: PostReference[] = await Promise.all(
        chart.embeddedIn.map(async (postId: any) => {
            const postRecord = await graph.find(GraphType.Document, postId)
            const post = postRecord.payload.records[0]
            return {
                id: postId,
                title: post.title,
                slug: post.slug,
            }
        })
    )
    return uniqBy(
        [...relatedArticles, ...publishedGdocPostsThatReferenceChart],
        "slug"
    ).sort(
        // Alphabetise
        (a, b) => (a.title.toLowerCase() > b.title.toLowerCase() ? 1 : -1)
    )
}

export const getBlockApiFromApi = async (id: number): Promise<any> => {
    if (!isWordpressAPIEnabled) return undefined

    const query = `
    query getBlock($id: ID!) {
        wpBlock(id: $id, idType: DATABASE_ID) {
          content
        }
      }
    `
    return graphqlQuery(query, { id })
}

export const getTopics = async (cursor: string = ""): Promise<Topic[]> => {
    if (!isWordpressAPIEnabled) return []
    const query = `query {
        pages (first: 100, after:"${cursor}", where: {categoryId:${ENTRIES_CATEGORY_ID}} ) {
            pageInfo {
                hasNextPage
                endCursor
            }
            nodes {
                id: databaseId
                name: title
            }
        }
      }`

    const documents = await graphqlQuery(query, { cursor })
    const pageInfo = documents.data.pages.pageInfo
    const topics: Topic[] = documents.data.pages.nodes
    if (topics.length === 0) return []

    if (pageInfo.hasNextPage) {
        return topics.concat(await getTopics(pageInfo.endCursor))
    } else {
        return topics
    }
}
