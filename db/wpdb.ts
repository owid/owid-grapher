import { decodeHTML } from "entities"
import { DatabaseConnection } from "./DatabaseConnection"
import {
    WORDPRESS_DB_NAME,
    WORDPRESS_DB_HOST,
    WORDPRESS_DB_PORT,
    WORDPRESS_DB_USER,
    WORDPRESS_DB_PASS,
    WORDPRESS_API_PASS,
    WORDPRESS_API_USER,
} from "../settings/serverSettings"
import {
    WORDPRESS_URL,
    BAKED_BASE_URL,
    BLOG_SLUG,
} from "../settings/serverSettings"
import * as db from "./db"
import { Knex, knex } from "knex"
import fetch from "node-fetch"
import { Base64 } from "js-base64"
import { registerExitHandler } from "./cleanup"
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
    WP_MediaSizes,
} from "../clientUtils/owidTypes"
import { getContentGraph, GraphType } from "./contentGraph"
import { memoize } from "../clientUtils/Util"
import { Url } from "../clientUtils/urls/Url"

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
                content
            }
        }
    }
    `
    const documents = await graphqlQuery(query, { cursor })
    const pageInfo = documents?.data[typePlural].pageInfo
    const nodes = documents?.data[typePlural].nodes
    if (pageInfo.hasNextPage) {
        return nodes.concat(
            await getDocumentsInfo(type, pageInfo.endCursor, where)
        )
    } else {
        return nodes
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

    const query = `
    query getEntriesByCategory($first: Int, $orderby: TermObjectsConnectionOrderbyEnum!) {
        categories(first: $first, where: {termTaxonomId: ${ENTRIES_CATEGORY_ID}, orderby: $orderby}) {
          nodes {
            name
            children(first: $first, where: {orderby: $orderby}) {
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

// Limit not supported with multiple post types:
// When passing multiple post types, the limit is applied to the resulting array
// of sequentially sorted posts (all blog posts, then all pages, ...), so there
// will be a predominance of a certain post type.
export const getPosts = async (
    postTypes: string[] = [WP_PostType.Post, WP_PostType.Page],
    limit?: number
): Promise<any[]> => {
    if (!isWordpressAPIEnabled) return []

    const perPage = 50
    let posts: any[] = []

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
    posts = posts.filter(
        (post) =>
            !excludedSlugs.includes(post.slug) &&
            !post.slug.endsWith("-country-profile")
    )

    return limit ? posts.slice(0, limit) : posts
}

export const getPostType = async (search: number | string): Promise<string> => {
    const paramName = typeof search === "number" ? "id" : "slug"
    return apiQuery(`${OWID_API_ENDPOINT}/type`, {
        searchParams: [[paramName, search]],
    })
}

export const getPostBySlug = async (slug: string): Promise<FullPost> => {
    if (!isWordpressAPIEnabled) {
        throw new JsonError(`Need wordpress API to match slug ${slug}`, 404)
    }

    try {
        const type = await getPostType(slug)
        const postArr = await apiQuery(
            `${WP_API_ENDPOINT}/${getEndpointSlugFromType(type)}`,
            {
                searchParams: [["slug", slug]],
            }
        )
        return getFullPost(postArr[0])
    } catch (err) {
        throw new JsonError(`No page found by slug ${slug}`, 404)
    }
}

// the /revisions endpoint does not send back all the metadata required for
// the proper rendering of the post (e.g. authors), hence the double request.
export const getLatestPostRevision = async (id: number): Promise<any> => {
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
    // - glossary highlights
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
            charts.config->>"$.variantName" AS variantName
        FROM charts
        INNER JOIN chart_tags ON charts.id=chart_tags.chartId
        INNER JOIN post_tags ON chart_tags.tagId=post_tags.tag_id
        WHERE post_tags.post_id=${postId}
        AND charts.config->>"$.isPublished" = "true"
        ORDER BY title ASC
    `)

export const getRelatedArticles = async (
    chartSlug: string
): Promise<PostReference[] | undefined> => {
    const graph = await getContentGraph()

    const chartRecord = await graph.find(GraphType.Chart, chartSlug)

    if (!chartRecord.payload.count) return

    const chart = chartRecord.payload.records[0]
    const relatedArticles: PostReference[] = await Promise.all(
        chart.research.map(async (postId: any) => {
            const postRecord = await graph.find(GraphType.Document, postId)
            const post = postRecord.payload.records[0]
            return {
                id: postId,
                title: post.title,
                slug: post.slug,
            }
        })
    )
    return relatedArticles
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
    postApi: any,
    excludeContent?: boolean
): Promise<FullPost> => ({
    id: postApi.id,
    type: postApi.type,
    slug: postApi.slug,
    path: postApi.slug, // kept for transitioning between legacy BPES (blog post as entry section) and future hierarchical paths
    title: decodeHTML(postApi.title.rendered),
    subtitle: postApi.meta.owid_subtitle_meta_field,
    date: new Date(postApi.date_gmt),
    modifiedDate: new Date(postApi.modified_gmt),
    authors: postApi.authors_name || [],
    content: excludeContent ? "" : postApi.content.rendered,
    excerpt: decodeHTML(postApi.excerpt.rendered),
    imageUrl: `${BAKED_BASE_URL}${
        postApi.featured_media_path ?? "/default-thumbnail.jpg"
    }`,
    imageId: postApi.featured_media,
    relatedCharts:
        postApi.type === "page"
            ? await getRelatedCharts(postApi.id)
            : undefined,
    glossary: postApi.meta.owid_glossary_meta_field,
})

export const getBlogIndex = memoize(async (): Promise<FullPost[]> => {
    // TODO: do not get post content in the first place
    const posts = await getPosts(["post"])
    return Promise.all(posts.map((post) => getFullPost(post, true)))
})

export const getMediaThumbnailUrl = async (
    id: number
): Promise<string | undefined> => {
    const query = `
    query getMediaSizes($id: ID!) {
        mediaItem(id: $id, idType: DATABASE_ID) {
          mediaDetails {
            sizes {
              name
              sourceUrl
            }
          }
        }
      }
    `

    const mediaSizes = await graphqlQuery(query, { id })

    const thumbnail = mediaSizes?.data?.mediaItem?.mediaDetails?.sizes?.find(
        (mediaSize: { name: WP_MediaSizes; sourceUrl: string }) =>
            mediaSize.name === WP_MediaSizes.Thumbnail
    )

    return thumbnail?.sourceUrl
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

export const flushCache = () => {
    cachedAuthorship = undefined
    cachedEntries = []
    cachedFeaturedImages = undefined
    getBlogIndex.cache.clear?.()
    cachedTables = undefined
}
