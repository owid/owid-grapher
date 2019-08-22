import {decodeHTML} from 'entities'
const slugify = require('slugify')
import { DatabaseConnection } from 'db/DatabaseConnection'
import {WORDPRESS_DB_NAME, WORDPRESS_DIR, WORDPRESS_DB_HOST, WORDPRESS_DB_PORT, WORDPRESS_DB_USER, WORDPRESS_DB_PASS, WORDPRESS_API_PASS, WORDPRESS_API_USER} from 'serverSettings'
import {WORDPRESS_URL} from 'settings'
import * as Knex from 'knex'
import fetch from 'node-fetch'

import * as path from 'path'
import * as glob from 'glob'
import * as _ from 'lodash'
import * as db from 'db/db'
import { Post } from 'db/model/Post'

import { promisify } from 'util'
import * as imageSizeStandard from 'image-size'
import { Chart } from 'charts/Chart'
import { defaultTo } from 'charts/Util'
import { Base64 } from 'js-base64'

const imageSize = promisify(imageSizeStandard) as any
class WPDB {
    conn?: DatabaseConnection

    knex(tableName?: string | Knex.Raw | Knex.QueryBuilder | undefined) {
        if (!knexInstance) {
            knexInstance = Knex({
                client: 'mysql',
                connection: {
                    host: WORDPRESS_DB_HOST,
                    port: WORDPRESS_DB_PORT,
                    user: WORDPRESS_DB_USER,
                    password: WORDPRESS_DB_PASS,
                    database: WORDPRESS_DB_NAME
                }
            })
        }

        return knexInstance(tableName)
    }

    async connect() {
        this.conn = new DatabaseConnection({
            host: WORDPRESS_DB_HOST,
            port: WORDPRESS_DB_PORT,
            user: WORDPRESS_DB_USER,
            password: WORDPRESS_DB_PASS,
            database: WORDPRESS_DB_NAME
        })
        await this.conn.connect()
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

const wpdb = new WPDB()

const WP_API_ENDPOINT = `${WORDPRESS_URL}/wp-json/wp/v2`
const OWID_API_ENDPOINT = `${WORDPRESS_URL}/wp-json/owid/v1`

async function apiQuery(endpoint: string, searchParams: array<array>): Promise<any> {
    const url = new URL(endpoint)

    // The edit context gives access to title.raw and excerpt.raw
    url.searchParams.append('context', 'edit')

    if(searchParams) {
        searchParams.forEach((param) => {
            url.searchParams.append(...param)
        })
    }
    return fetch(url.toString(), {
        headers: [
            ['Authorization', 'Basic ' + Base64.encode(`${WORDPRESS_API_USER}:${WORDPRESS_API_PASS}`)]
        ]
    })
}

export async function query(queryStr: string, params?: any[]): Promise<any[]> {
    return wpdb.query(queryStr, params)
}

export async function get(queryStr: string, params?: any[]): Promise<any> {
    return wpdb.get(queryStr, params)
}

export async function connect() {
    await wpdb.connect()
}

export async function end() {
    if (wpdb.conn) wpdb.conn.end()
    if (knexInstance) await knexInstance.destroy()
}

interface ImageUpload {
    slug: string
    originalUrl: string
    variants: {
        url: string
        width: number
        height: number
    }[]
}

let cachedUploadDex: Map<string, ImageUpload>
export async function getUploadedImages() {
    if (cachedUploadDex)
        return cachedUploadDex

    const paths = glob.sync(path.join(WORDPRESS_DIR, 'wp-content/uploads/**/*'))

    const uploadDex = new Map<string, ImageUpload>()

    for (const filepath of paths) {
        const filename = path.basename(filepath)
        const match = filepath.match(/(\/wp-content.*\/)([^\/]*?)-?(\d+x\d+)?\.(png|jpg|jpeg|gif)$/)
        if (match) {
            const dimensions = await imageSize(filepath)
            const [_, dirpath, slug, dims, filetype] = match
            let upload = uploadDex.get(dirpath+slug)
            if (!upload) {
                upload = {
                    slug: slug,
                    originalUrl: `${path.join(dirpath, slug)}.${filetype}`,
                    variants: []
                }
                uploadDex.set(dirpath+slug, upload)
            }

            upload.variants.push({
                url: path.join(dirpath, filename),
                width: dimensions.width,
                height: dimensions.height
            })

            uploadDex.set(filename, upload)
        }
    }

    uploadDex.forEach(upload => {
        upload.variants = _.sortBy(upload.variants, v => v.width)
    })

    cachedUploadDex = uploadDex
    return uploadDex
}

// Retrieve a map of post ids to authors
let cachedAuthorship: Map<number, string[]>
export async function getAuthorship(): Promise<Map<number, string[]>> {
    if (cachedAuthorship) return cachedAuthorship

    const authorRows = await wpdb.query(`
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

export interface EntryMeta {
    slug: string
    title: string
    excerpt: string
}

export interface CategoryWithEntries {
    name: string
    slug: string
    entries: EntryMeta[]
}

export async function getCategoriesByPostId(): Promise<Map<number, string[]>> {
    const categoriesByPostId = new Map<number, string[]>()
    const rows = await wpdb.query(`
        SELECT object_id, terms.name FROM wp_term_relationships AS rels
        LEFT JOIN wp_terms AS terms ON terms.term_id=rels.term_taxonomy_id
    `)

    for (const row of rows) {
        let cats = categoriesByPostId.get(row.object_id)
        if (!cats) {
            cats = []
            categoriesByPostId.set(row.object_id, cats)
        }
        cats.push(row.name)
    }

    return categoriesByPostId
}

export async function getTagsByPostId(): Promise<Map<number, string[]>> {
    const tagsByPostId = new Map<number, string[]>()
    const rows = await wpdb.query(`
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

// Retrieve a list of categories and their associated entries
let cachedEntries: CategoryWithEntries[]
export async function getEntriesByCategory(): Promise<CategoryWithEntries[]> {
    if (cachedEntries) return cachedEntries

    const categoryOrder = [
        "Population",
        "Health",
        "Food" ,
        "Energy",
        "Environment",
        "Technology",
        "Growth &amp; Inequality",
        "Work &amp; Life",
        "Public Sector",
        "Global Connections",
        "War &amp; Peace",
        "Politics" ,
        "Violence &amp; Rights",
        "Education",
        "Media",
        "Culture"
    ]

    const pageRows = await wpdb.query(`
        SELECT posts.ID, post_title, post_date, post_name, post_excerpt FROM wp_posts AS posts
        WHERE posts.post_type='page' AND posts.post_status='publish' ORDER BY posts.menu_order ASC, posts.post_title ASC
    `)

    const permalinks = await getPermalinks()

    const categoriesByPageId = await getCategoriesByPostId()

    cachedEntries = categoryOrder.map(cat => {
        const rows = pageRows.filter(row => {
            const cats = categoriesByPageId.get(row.ID)
            return cats && cats.indexOf(cat) !== -1
        })

        const entries = rows.map(row => {
            return {
                slug: permalinks.get(row.ID, row.post_name),
                title: row.post_title,
                excerpt: row.post_excerpt
            }
        })

        return {
            name: decodeHTML(cat),
            slug: slugify(decodeHTML(cat).toLowerCase()),
            entries: entries
        }
    })

    return cachedEntries
}

export async function getPermalinks() {
    return {
        // Strip trailing slashes, and convert __ into / to allow custom subdirs like /about/media-coverage
        get: (ID: number, postName: string) => postName.replace(/\/+$/g, "").replace(/--/g, "/").replace(/__/g, "/")
    }
}

let cachedFeaturedImages: Map<number, string>
export async function getFeaturedImages() {
    if (cachedFeaturedImages)
        return cachedFeaturedImages

    const rows = await wpdb.query(`SELECT wp_postmeta.post_id, wp_posts.guid FROM wp_postmeta INNER JOIN wp_posts ON wp_posts.ID=wp_postmeta.meta_value WHERE wp_postmeta.meta_key='_thumbnail_id'`)

    const featuredImages = new Map<number, string>()
    for (const row of rows) {
        featuredImages.set(row.post_id, row.guid)
    }

    cachedFeaturedImages = featuredImages
    return featuredImages
}

export async function getFeaturedImageUrl(postId: number): Promise<string|undefined> {
    if (cachedFeaturedImages)
        return cachedFeaturedImages.get(postId)
    else {
        const rows = await wpdb.query(`
            SELECT wp_postmeta.post_id, wp_posts.guid
            FROM wp_postmeta
            INNER JOIN wp_posts ON wp_posts.ID=wp_postmeta.meta_value
            WHERE wp_postmeta.meta_key='_thumbnail_id' AND wp_postmeta.post_id=?`, [postId])
        return rows.length ? rows[0].guid : undefined
    }
}

function getEndpointSlugFromType($type) {
    const postTypeEndpointSlugs = {
        post: 'posts',
        page: 'pages'
    }
    return postTypeEndpointSlugs[$type]
}

// Limit not supported with multiple post types:
// When passing multiple post types, the limit is applied to the resulting array
// of sequentially sorted posts (all blog posts, then all pages, ...), so there
// will be a predominance of a certain post type.
export async function getPosts(postTypes: string[]=['post', 'page'], limit: number): Promise<[]> {
    const perPage = 50
    const posts = []
    let response

    for(const postType of postTypes) {
        const endpoint = `${WP_API_ENDPOINT}/${getEndpointSlugFromType(postType)}`

        // Get number of items to retrieve
        response = await apiQuery(endpoint, [['per_page', 1]])
        const maxAvailable = response.headers.get("X-WP-TotalPages")
        const count = limit && limit < maxAvailable ? limit : maxAvailable

        for (let page = 1; page <= Math.ceil(count / perPage); page++) {
            response = await apiQuery(endpoint, [['per_page', perPage],['page', page]])
            const postsCurrentPage = await response.json()
            posts.push(...postsCurrentPage)
        }
    }
    return limit ? posts.slice(0, limit) : posts
}

export async function getPostType(search: number|string): Promise<string> {
    const paramName = typeof search === "number" ? 'id' : 'slug'
    const response = await apiQuery(`${OWID_API_ENDPOINT}/type`, [[paramName, search]])
    const type = await response.json()

    return type
}

export async function getPost(id: number): Promise<object> {
    const type = await getPostType(id)
    const response = await apiQuery(`${WP_API_ENDPOINT}/${getEndpointSlugFromType(type)}/${id}`)
    const post = await response.json()

    return post
}

export async function getPostBySlug(slug: string): Promise<object> {
    const type = await getPostType(slug)
    const response = await apiQuery(`${WP_API_ENDPOINT}/${getEndpointSlugFromType(type)}`, [['slug', slug]])
    const postArray = await response.json()

    return postArray
}

export async function getLatestPostRevision(id: number): Promise<object> {
    const type = await getPostType(id)
    const response = await apiQuery(`${WP_API_ENDPOINT}/${getEndpointSlugFromType(type)}/${id}/revisions`)
    const revisions = await response.json()

    return revisions[0]
}

export interface FullPost {
    id: number
    type: 'post'|'page'
    slug: string
    title: string
    date: Date
    modifiedDate: Date
    authors: string[]
    content: string
    excerpt?: string
    imageUrl?: string
}

export function getFullPostApi(post: object, excludeContent?: boolean): FullPost {
    return {
        id: post.id,
        type: post.type,
        slug: post.path,
        title: post.title.raw,
        date: new Date(post.date),
        modifiedDate: new Date(post.modified),
        authors: post.authors_name || [],
        content: excludeContent ? '' : post.content.rendered,
        excerpt: post.excerpt.raw,
        imageUrl: defaultTo(post.featured_media_path, '/default-thumbnail.jpg')
    }
}

export async function getFullPost(row: any): Promise<FullPost> {
    const authorship = await getAuthorship()
    const permalinks = await getPermalinks()
    const featuredImageUrl = await getFeaturedImageUrl(row.ID)

    const postId = row.post_status === "inherit" ? row.post_parent : row.ID

    return {
        id: row.ID,
        type: row.post_type,
        slug: permalinks.get(row.ID, row.post_name),
        title: row.post_title,
        date: new Date(row.post_date_gmt),
        modifiedDate: new Date(row.post_modified_gmt),
        authors: authorship.get(postId) || [],
        content: row.post_content,
        excerpt: row.post_excerpt,
        imageUrl: featuredImageUrl
    }
}

let cachedPosts: FullPost[]
export async function getBlogIndex(): Promise<FullPost[]> {
    if (cachedPosts) return cachedPosts

    // TODO: do not get post content in the first place
    const posts = await getPosts(['post'])

    cachedPosts = posts.map(post => {
        return getFullPostApi(post, true)
    })

    return cachedPosts
}

interface TablepressTable {
    tableId: string
    data: string[][]
}

let cachedTables: Map<string, TablepressTable>
export async function getTables(): Promise<Map<string, TablepressTable>> {
    if (cachedTables) return cachedTables

    const optRows = await wpdb.query(`
        SELECT option_value AS json FROM wp_options WHERE option_name='tablepress_tables'
    `)

    const tableToPostIds = JSON.parse(optRows[0].json).table_post

    const rows = await wpdb.query(`
        SELECT ID, post_content FROM wp_posts WHERE post_type='tablepress_table'
    `)

    const tableContents = new Map<string, string>()
    for (const row of rows) {
        tableContents.set(row.ID, row.post_content)
    }

    cachedTables = new Map()
    for (const tableId in tableToPostIds) {
        const data = JSON.parse(tableContents.get(tableToPostIds[tableId])||"[]")
        cachedTables.set(tableId, {
            tableId: tableId,
            data: data
        })
    }

    return cachedTables
}

let knexInstance: Knex

export function knex(tableName?: string | Knex.Raw | Knex.QueryBuilder | undefined) {
    return wpdb.knex(tableName)
}
