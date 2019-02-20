import {decodeHTML} from 'entities'
const slugify = require('slugify')
import { DatabaseConnection } from 'db/DatabaseConnection'
import {WORDPRESS_DB_NAME, WORDPRESS_DIR, DB_HOST, DB_USER, DB_PASS} from 'serverSettings'
import * as Knex from 'knex'

import * as path from 'path'
import * as glob from 'glob'
import * as _ from 'lodash'
import * as db from 'db/db'

import { promisify } from 'util'
import * as imageSizeStandard from 'image-size'
import { Chart } from 'charts/Chart'
const imageSize = promisify(imageSizeStandard) as any
class WPDB {
    conn?: DatabaseConnection

    knex(tableName?: string | Knex.Raw | Knex.QueryBuilder | undefined) {
        if (!knexInstance) {
            knexInstance = Knex({
                client: 'mysql',
                connection: {
                    host: DB_HOST,
                    user: DB_USER,
                    password: DB_PASS,
                    database: WORDPRESS_DB_NAME
                }
            })
        }

        return knexInstance(tableName)
    }

    async connect() {
        this.conn = new DatabaseConnection({
            host: 'localhost',
            user: 'root',
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
        SELECT posts.ID, post_title, post_date, post_name FROM wp_posts AS posts
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
                title: row.post_title
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

export interface PostInfo {
    title: string
    date: Date
    slug: string
    authors: string[]
    imageUrl?: string
}

let cachedPosts: PostInfo[]
export async function getBlogIndex(): Promise<PostInfo[]> {
    if (cachedPosts) return cachedPosts

    const rows = await wpdb.query(`
        SELECT ID, post_title, post_date, post_name FROM wp_posts
        WHERE post_status='publish' AND post_type='post' ORDER BY post_date DESC
    `)

    const permalinks = await getPermalinks()
    const authorship = await getAuthorship()
    const featuredImages = await getFeaturedImages()

    cachedPosts = rows.map(row => {
        return {
            title: row.post_title,
            date: new Date(row.post_date),
            slug: permalinks.get(row.ID, row.post_name),
            authors: authorship.get(row.ID)||[],
            imageUrl: featuredImages.get(row.ID)
        }
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