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
import { Knex, knex } from "knex"
import { Base64 } from "js-base64"
import { registerExitHandler } from "./cleanup.js"
import { WP_PostType, JsonError, PostRestApi } from "@ourworldindata/utils"
import { Redirect } from "@ourworldindata/types"

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

export const FOR_SYNC_ONLY_WP_API_ENDPOINT = `${WORDPRESS_URL}/wp-json/wp/v2`
export const FOR_SYNC_ONLY_WP_GRAPHQL_ENDPOINT = `${WORDPRESS_URL}/wp/graphql`

/* Wordpress GraphQL API query
 *
 * Note: in contrast to the REST API query, the GraphQL query does not throw when a
 * resource is not found, as GraphQL returns a 200, with a shape that is different between
 * every query. So it is the caller's responsibility to throw (if necessary) on
 * "faux 404".
 */
export const FOR_SYNC_ONLY_graphqlQuery = async (
    query: string,
    variables: any = {}
): Promise<any> => {
    const response = await fetch(FOR_SYNC_ONLY_WP_GRAPHQL_ENDPOINT, {
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
export const FOR_SYNC_ONLY_apiQuery = async (
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

// page => pages, post => posts
export const FOR_SYNC_ONLY_getEndpointSlugFromType = (type: string): string =>
    `${type}s`

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
export const SYNC_ONLY_getPostIdAndTypeBySlug = async (
    slug: string
): Promise<{ id: number; type: string } | undefined> => {
    const rows = await singleton.query(
        "SELECT ID, post_type FROM wp_posts WHERE `post_name` = ? AND post_type IN ( ? )",
        [slug, [WP_PostType.Post, WP_PostType.Page]]
    )

    if (!rows.length) return

    return { id: rows[0].ID, type: rows[0].post_type }
}

export const FOR_SYNC_ONLY_getPostApiBySlugFromApi = async (
    slug: string
): Promise<PostRestApi> => {
    if (!isWordpressAPIEnabled) {
        throw new JsonError(`Need wordpress API to match slug ${slug}`, 404)
    }

    const postIdAndType = await SYNC_ONLY_getPostIdAndTypeBySlug(slug)
    if (!postIdAndType)
        throw new JsonError(`No page found by slug ${slug}`, 404)

    const { id, type } = postIdAndType

    return FOR_SYNC_ONLY_apiQuery(
        `${FOR_SYNC_ONLY_WP_API_ENDPOINT}/${FOR_SYNC_ONLY_getEndpointSlugFromType(
            type
        )}/${id}`
    )
}

export interface RelatedResearchQueryResult {
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
export const FOR_SYNC_ONLY_getBlockApiFromApi = async (
    id: number
): Promise<any> => {
    if (!isWordpressAPIEnabled) return undefined

    const query = `
    query getBlock($id: ID!) {
        wpBlock(id: $id, idType: DATABASE_ID) {
          content
        }
      }
    `
    return FOR_SYNC_ONLY_graphqlQuery(query, { id })
}

export interface FOR_SYNC_ONLY_TablepressTable {
    tableId: string
    data: string[][]
}
export const FOR_SYNC_ONLY_getTables = async (): Promise<
    Map<string, FOR_SYNC_ONLY_TablepressTable>
> => {
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

    const tables = new Map()
    for (const tableId in tableToPostIds) {
        const data = JSON.parse(
            tableContents.get(tableToPostIds[tableId]) || "[]"
        )
        tables.set(tableId, {
            tableId: tableId,
            data: data,
        })
    }

    return tables
}

export const FOR_SYNC_ONLY_getRedirects = async (): Promise<Redirect[]> => {
    return singleton.query(`
        SELECT url AS source, action_data AS target, action_code AS code
        FROM wp_redirection_items WHERE status = 'enabled'
    `)
}
