import { decodeHTML } from "entities"
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
    BAKED_BASE_URL,
    BLOG_SLUG,
} from "../settings/serverSettings.js"
import * as db from "./db.js"
import { Knex, knex } from "knex"
import { Base64 } from "js-base64"
import { registerExitHandler } from "./cleanup.js"
import {
    RelatedChart,
    CategoryWithEntries,
    EntryNode,
    FullPost,
    WP_PostType,
    DocumentNode,
    PostReference,
    JsonError,
    CategoryNode,
    FilterFnPostRestApi,
    PostRestApi,
    TopicId,
    GraphType,
    memoize,
    IndexPost,
    orderBy,
    IMAGES_DIRECTORY,
    uniqBy,
    sortBy,
    DataPageRelatedResearch,
    OwidGdocType,
    Tag,
    OwidGdocPostInterface,
} from "@ourworldindata/utils"
import { Topic } from "@ourworldindata/types"
import {
    getContentGraph,
    WPPostTypeToGraphDocumentType,
} from "./contentGraph.js"
import { TOPICS_CONTENT_GRAPH } from "../settings/clientSettings.js"
import { GdocPost } from "./model/Gdoc/GdocPost.js"
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

const WP_API_ENDPOINT = `${WORDPRESS_URL}/wp-json/wp/v2`
const OWID_API_ENDPOINT = `${WORDPRESS_URL}/wp-json/owid/v1`
const WP_GRAPHQL_ENDPOINT = `${WORDPRESS_URL}/wp/graphql`

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
const apiQuery = async (
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

// Retrieve a map of post ids to authors
let cachedAuthorship: Map<number, string[]> | undefined
export const getAuthorship = async (): Promise<Map<number, string[]>> => {
    if (cachedAuthorship) return cachedAuthorship

    const authorRows = await singleton.query(`
        SELECT object_id, terms.description FROM wp_term_relationships AS rels
        LEFT JOIN wp_term_taxonomy AS terms ON terms.term_taxonomy_id=rels.term_taxonomy_id
        WHERE terms.taxonomy='author'
        ORDER BY rels.term_order ASC
    `)

    const authorship = new Map<number, string[]>()
    for (const row of authorRows) {
        let authors = authorship.get(row.object_id)
        if (!authors) {
            authors = []
            authorship.set(row.object_id, authors)
        }
        authors.push(row.description.split(" ").slice(0, 2).join(" "))
    }

    cachedAuthorship = authorship
    return authorship
}

export const getTagsByPostId = async (): Promise<Map<number, string[]>> => {
    const tagsByPostId = new Map<number, string[]>()
    const rows = await singleton.query(`
        SELECT p.id, t.name
        FROM wp_posts p
        JOIN wp_term_relationships tr
            on (p.id=tr.object_id)
        JOIN wp_term_taxonomy tt
            on (tt.term_taxonomy_id=tr.term_taxonomy_id
            and tt.taxonomy='post_tag')
        JOIN wp_terms t
            on (tt.term_id=t.term_id)
    `)

    for (const row of rows) {
        let cats = tagsByPostId.get(row.id)
        if (!cats) {
            cats = []
            tagsByPostId.set(row.id, cats)
        }
        cats.push(row.name)
    }

    return tagsByPostId
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

const getEntryNode = ({
    slug,
    title,
    excerpt,
    kpi,
}: EntryNode): {
    slug: string
    title: string
    excerpt: string
    kpi: string
} => ({
    slug,
    title: decodeHTML(title),
    excerpt: excerpt === null ? "" : decodeHTML(excerpt),
    kpi,
})

const isEntryInSubcategories = (entry: EntryNode, subcategories: any): any => {
    return subcategories.some((subcategory: any) => {
        return subcategory.pages.nodes.some(
            (node: EntryNode) => entry.slug === node.slug
        )
    })
}

// Retrieve a list of categories and their associated entries
let cachedEntries: CategoryWithEntries[] = []
export const getEntriesByCategory = async (): Promise<
    CategoryWithEntries[]
> => {
    if (!isWordpressAPIEnabled) return []
    if (cachedEntries.length) return cachedEntries

    const first = 100
    // The filtering of cached entries below makes the $first argument
    // less accurate, as it does not represent the exact number of entries
    // returned per subcategories but rather their maximum number of entries.
    const orderby = "TERM_ORDER"

    // hack: using the description field ("01", "02", etc.) to order the top
    // categories as TERM_ORDER doesn't seem to work as expected anymore.
    const query = `
    query getEntriesByCategory($first: Int, $orderby: TermObjectsConnectionOrderbyEnum!) {
        categories(first: $first, where: {termTaxonomId: ${ENTRIES_CATEGORY_ID}, orderby: $orderby}) {
          nodes {
            name
            children(first: $first, where: {orderby: DESCRIPTION}) {
              nodes {
                ...categoryWithEntries
                children(first: $first, where: {orderby: $orderby}) {
                  nodes {
                    ...categoryWithEntries
                  }
                }
              }
            }
          }
        }
      }

      fragment categoryWithEntries on Category {
        name
        slug
        pages(first: $first, where: {orderby: {field: MENU_ORDER, order: ASC}}) {
          nodes {
            slug
            title
            excerpt
            kpi
          }
        }
      }
      `
    const categories = await graphqlQuery(query, { first, orderby })

    cachedEntries = categories.data.categories.nodes[0].children.nodes.map(
        ({ name, slug, pages, children }: CategoryNode) => ({
            name: decodeHTML(name),
            slug,
            entries: pages.nodes
                .filter(
                    (node: EntryNode) =>
                        /* As entries are sometimes listed at all levels of the category hierarchy
                        (e.g. "Entries" > "Demographic Change" > "Life and Death" for "Child and
                        Infant Mortality"), it is necessary to filter out duplicates, by giving precedent to
                        the deepest level. In other words, if an entry is present in category 1 and category
                        1.1, it will only show in category 1.1.

                        N.B. Pre wp-graphql 0.6.0, entries would be returned at all levels of the category
                        hierarchy, no matter what categories were effectively selected. 0.6.0 fixes that
                        (cf. https://github.com/wp-graphql/wp-graphql/issues/1100). Even though this behaviour
                        has been fixed, we still have potential duplicates, from the multiple hierarchical
                        selection as noted above. The only difference is the nature of the duplicate, which can
                        now be considered more intentional as it is coming from the data / CMS.
                        Ultimately, this discrepency in the data should be addressed to make the system
                        less permissive. */
                        !isEntryInSubcategories(node, children.nodes)
                )
                .map((node: EntryNode) => getEntryNode(node)),
            subcategories: children.nodes
                .filter(
                    (subcategory: CategoryNode) =>
                        subcategory.pages.nodes.length !== 0
                )
                .map(({ name, slug, pages }: CategoryNode) => ({
                    name: decodeHTML(name),
                    slug,
                    entries: pages.nodes.map((node: EntryNode) =>
                        getEntryNode(node)
                    ),
                })),
        })
    )

    return cachedEntries
}

export const isPostCitable = async (post: FullPost): Promise<boolean> => {
    const entries = await getEntriesByCategory()
    return entries.some((category) => {
        return (
            category.entries.some((entry) => entry.slug === post.slug) ||
            category.subcategories.some((subcategory: CategoryWithEntries) => {
                return subcategory.entries.some(
                    (subCategoryEntry) => subCategoryEntry.slug === post.slug
                )
            })
        )
    })
}

export const getPermalinks = async (): Promise<{
    // Strip trailing slashes, and convert __ into / to allow custom subdirs like /about/media-coverage
    get: (ID: number, postName: string) => string
}> => ({
    // Strip trailing slashes, and convert __ into / to allow custom subdirs like /about/media-coverage
    get: (ID: number, postName: string): string =>
        postName.replace(/\/+$/g, "").replace(/--/g, "/").replace(/__/g, "/"),
})

let cachedFeaturedImages: Map<number, string> | undefined
export const getFeaturedImages = async (): Promise<Map<number, string>> => {
    if (cachedFeaturedImages) return cachedFeaturedImages

    const rows = await singleton.query(
        `SELECT wp_postmeta.post_id, wp_posts.guid FROM wp_postmeta INNER JOIN wp_posts ON wp_posts.ID=wp_postmeta.meta_value WHERE wp_postmeta.meta_key='_thumbnail_id'`
    )

    const featuredImages = new Map<number, string>()
    for (const row of rows) {
        featuredImages.set(row.post_id, row.guid)
    }

    cachedFeaturedImages = featuredImages
    return featuredImages
}

// page => pages, post => posts
const getEndpointSlugFromType = (type: string): string => `${type}s`

export const selectHomepagePosts: FilterFnPostRestApi = (post) =>
    post.meta?.owid_publication_context_meta_field?.homepage === true

// Limit not supported with multiple post types:
// When passing multiple post types, the limit is applied to the resulting array
// of sequentially sorted posts (all blog posts, then all pages, ...), so there
// will be a predominance of a certain post type.
export const getPosts = async (
    postTypes: string[] = [WP_PostType.Post, WP_PostType.Page],
    filterFunc?: FilterFnPostRestApi,
    limit?: number
): Promise<PostRestApi[]> => {
    if (!isWordpressAPIEnabled) return []

    const perPage = 20
    const posts: PostRestApi[] = []

    for (const postType of postTypes) {
        const endpoint = `${WP_API_ENDPOINT}/${getEndpointSlugFromType(
            postType
        )}`

        // Get number of items to retrieve
        const headers = await apiQuery(endpoint, {
            searchParams: [["per_page", 1]],
            returnResponseHeadersOnly: true,
        })
        const maxAvailable = headers.get("X-WP-TotalPages")
        const count = limit && limit < maxAvailable ? limit : maxAvailable

        for (let page = 1; page <= Math.ceil(count / perPage); page++) {
            const postsCurrentPage = await apiQuery(endpoint, {
                searchParams: [
                    ["per_page", perPage],
                    ["page", page],
                ],
            })
            posts.push(...postsCurrentPage)
        }
    }

    // Published pages excluded from public views
    const excludedSlugs = [BLOG_SLUG]

    const filterConditions: Array<FilterFnPostRestApi> = [
        (post): boolean => !excludedSlugs.includes(post.slug),
        (post): boolean => !post.slug.endsWith("-country-profile"),
    ]
    if (filterFunc) filterConditions.push(filterFunc)

    const filteredPosts = posts.filter((post) =>
        filterConditions.every((c) => c(post))
    )

    return limit ? filteredPosts.slice(0, limit) : filteredPosts
}

// todo / refactor : narrow down scope to getPostTypeById?
export const getPostType = async (search: number | string): Promise<string> => {
    const paramName = typeof search === "number" ? "id" : "slug"
    return apiQuery(`${OWID_API_ENDPOINT}/type`, {
        searchParams: [[paramName, search]],
    })
}

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

// We might want to cache this as the network of prominent links densifies and
// multiple requests to the same posts are happening.
export const getPostBySlug = async (slug: string): Promise<FullPost> => {
    if (!isWordpressAPIEnabled) {
        throw new JsonError(`Need wordpress API to match slug ${slug}`, 404)
    }

    const postIdAndType = await getPostIdAndTypeBySlug(slug)
    if (!postIdAndType)
        throw new JsonError(`No page found by slug ${slug}`, 404)

    const { id, type } = postIdAndType

    const postArr = await apiQuery(
        `${WP_API_ENDPOINT}/${getEndpointSlugFromType(type)}/${id}`
    )

    return getFullPost(postArr)
}

// the /revisions endpoint does not send back all the metadata required for
// the proper rendering of the post (e.g. authors), hence the double request.
export const getLatestPostRevision = async (id: number): Promise<FullPost> => {
    const type = await getPostType(id)
    const endpointSlug = getEndpointSlugFromType(type)

    const postApi = await apiQuery(`${WP_API_ENDPOINT}/${endpointSlug}/${id}`)

    const revision = (
        await apiQuery(
            `${WP_API_ENDPOINT}/${endpointSlug}/${id}/revisions?per_page=1`
        )
    )[0]

    // Since WP does not store metadata for revisions, some elements of a
    // previewed page will not reflect the latest edits:
    // - published date (will show the correct one - that is the one in the
    //   sidebar - for unpublished posts though. For published posts, the
    //   current published date is displayed, regardless of what is shown
    //   and could have been modified in the sidebar.)
    // - authors
    // ...
    return getFullPost({
        ...postApi,
        content: revision.content,
        title: revision.title,
    })
}

export const getRelatedCharts = async (
    postId: number
): Promise<RelatedChart[]> =>
    db.queryMysql(`
        SELECT DISTINCT
            charts.config->>"$.slug" AS slug,
            charts.config->>"$.title" AS title,
            charts.config->>"$.variantName" AS variantName,
            chart_tags.keyChartLevel
        FROM charts
        INNER JOIN chart_tags ON charts.id=chart_tags.chartId
        INNER JOIN post_tags ON chart_tags.tagId=post_tags.tag_id
        WHERE post_tags.post_id=${postId}
        AND charts.config->>"$.isPublished" = "true"
        ORDER BY title ASC
    `)

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
        "grapher"
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

export const getBlockContent = async (
    id: number
): Promise<string | undefined> => {
    if (!isWordpressAPIEnabled) return undefined

    const query = `
    query getBlock($id: ID!) {
        wpBlock(id: $id, idType: DATABASE_ID) {
          content
        }
      }
    `
    const post = await graphqlQuery(query, { id })

    return post.data?.wpBlock?.content ?? undefined
}

export const getFullPost = async (
    postApi: PostRestApi,
    excludeContent?: boolean
): Promise<FullPost> => ({
    id: postApi.id,
    type: postApi.type,
    slug: postApi.slug,
    path: postApi.slug, // kept for transitioning between legacy BPES (blog post as entry section) and future hierarchical paths
    title: decodeHTML(postApi.title.rendered),
    date: new Date(postApi.date_gmt),
    modifiedDate: new Date(postApi.modified_gmt),
    authors: postApi.authors_name || [],
    content: excludeContent ? "" : postApi.content.rendered,
    excerpt: decodeHTML(postApi.excerpt.rendered),
    imageUrl: `${BAKED_BASE_URL}${
        postApi.featured_media_paths.medium_large ?? "/default-thumbnail.jpg"
    }`,
    thumbnailUrl: `${BAKED_BASE_URL}${
        postApi.featured_media_paths?.thumbnail ?? "/default-thumbnail.jpg"
    }`,
    imageId: postApi.featured_media,
    relatedCharts:
        postApi.type === "page"
            ? await getRelatedCharts(postApi.id)
            : undefined,
})

export const getBlogIndex = memoize(async (): Promise<IndexPost[]> => {
    await db.getConnection() // side effect: ensure connection is established
    const gdocPosts = await GdocPost.getListedGdocs()
    const wpPosts = await Promise.all(
        await getPosts([WP_PostType.Post], selectHomepagePosts).then((posts) =>
            posts.map((post) => getFullPost(post, true))
        )
    )

    const gdocSlugs = new Set(gdocPosts.map(({ slug }) => slug))
    const posts = [...mapGdocsToWordpressPosts(gdocPosts)]

    // Only adding each wpPost if there isn't already a gdoc with the same slug,
    // to make sure we use the most up-to-date metadata
    for (const wpPost of wpPosts) {
        if (!gdocSlugs.has(wpPost.slug)) {
            posts.push(wpPost)
        }
    }

    return orderBy(posts, (post) => post.date.getTime(), ["desc"])
})

export const mapGdocsToWordpressPosts = (
    gdocs: OwidGdocPostInterface[]
): IndexPost[] => {
    return gdocs.map((gdoc) => ({
        title: gdoc.content["atom-title"] || gdoc.content.title || "Untitled",
        slug: gdoc.slug,
        type: gdoc.content.type,
        date: gdoc.publishedAt as Date,
        modifiedDate: gdoc.updatedAt as Date,
        authors: gdoc.content.authors,
        excerpt: gdoc.content["atom-excerpt"] || gdoc.content.excerpt,
        imageUrl: gdoc.content["featured-image"]
            ? `${BAKED_BASE_URL}${IMAGES_DIRECTORY}${gdoc.content["featured-image"]}`
            : `${BAKED_BASE_URL}/default-thumbnail.jpg`,
    }))
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

interface TablepressTable {
    tableId: string
    data: string[][]
}

let cachedTables: Map<string, TablepressTable> | undefined
export const getTables = async (): Promise<Map<string, TablepressTable>> => {
    if (cachedTables) return cachedTables

    const optRows = await singleton.query(`
        SELECT option_value AS json FROM wp_options WHERE option_name='tablepress_tables'
    `)

    const tableToPostIds = JSON.parse(optRows[0].json).table_post

    const rows = await singleton.query(`
        SELECT ID, post_content FROM wp_posts WHERE post_type='tablepress_table'
    `)

    const tableContents = new Map<string, string>()
    for (const row of rows) {
        tableContents.set(row.ID, row.post_content)
    }

    cachedTables = new Map()
    for (const tableId in tableToPostIds) {
        const data = JSON.parse(
            tableContents.get(tableToPostIds[tableId]) || "[]"
        )
        cachedTables.set(tableId, {
            tableId: tableId,
            data: data,
        })
    }

    return cachedTables
}

export const flushCache = (): void => {
    cachedAuthorship = undefined
    cachedEntries = []
    cachedFeaturedImages = undefined
    getBlogIndex.cache.clear?.()
    cachedTables = undefined
}
