import mysql from "mysql"
import { DataSource, EntityManager } from "typeorm"
import { dataSource } from "./dataSource.js"
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
    MinimalDataInsightInterface,
    OwidGdocType,
} from "@ourworldindata/types"
let typeormDataSource: DataSource

export const getConnection = async (
    source: DataSource = dataSource
): Promise<DataSource> => {
    if (typeormDataSource) return typeormDataSource

    typeormDataSource = await source.initialize()

    registerExitHandler(async () => {
        if (typeormDataSource) await typeormDataSource.destroy()
    })

    return typeormDataSource
}

export class TransactionContext {
    manager: EntityManager
    constructor(manager: EntityManager) {
        this.manager = manager
    }

    execute(queryStr: string, params?: any[]): Promise<any> {
        return this.manager.query(
            params ? mysql.format(queryStr, params) : queryStr
        )
    }

    query(queryStr: string, params?: any[]): Promise<any> {
        return this.manager.query(
            params ? mysql.format(queryStr, params) : queryStr
        )
    }
}

export const transaction = async <T>(
    callback: (t: TransactionContext) => Promise<T>
): Promise<T> =>
    (await getConnection()).transaction(async (manager) =>
        callback(new TransactionContext(manager))
    )

export const queryMysql = async (
    queryStr: string,
    params?: any[]
): Promise<any> => {
    const conn = await getConnection()
    return conn.query(params ? mysql.format(queryStr, params) : queryStr)
}

// For operations that modify data (TODO: handling to check query isn't used for this)
export const execute = queryMysql

// Return the first match from a mysql query
export const mysqlFirst = async (
    queryStr: string,
    params?: any[]
): Promise<any> => {
    return (await queryMysql(queryStr, params))[0]
}

export const closeTypeOrmAndKnexConnections = async (): Promise<void> => {
    if (typeormDataSource) await typeormDataSource.destroy()
    if (_knexInstance) await _knexInstance.destroy()
}

let _knexInstance: Knex

export const knexInstance = (): Knex<any, any[]> => {
    if (_knexInstance) return _knexInstance

    _knexInstance = knex({
        client: "mysql",
        connection: {
            host: GRAPHER_DB_HOST,
            user: GRAPHER_DB_USER,
            password: GRAPHER_DB_PASS,
            database: GRAPHER_DB_NAME,
            port: GRAPHER_DB_PORT,
            typeCast: (field: any, next: any) => {
                if (field.type === "TINY" && field.length === 1) {
                    return field.string() === "1" // 1 = true, 0 = false
                }
                return next()
            },
        },
    })

    registerExitHandler(async () => {
        if (_knexInstance) await _knexInstance.destroy()
    })

    return _knexInstance
}

export const knexTable = (table: string): Knex.QueryBuilder =>
    knexInstance().table(table)

export const knexRaw = async <TRow = unknown>(
    str: string,
    knex: Knex<any, any[]>,
    params?: any[]
): Promise<TRow[]> => (await knex.raw(str, params ?? []))[0]

export const knexRawFirst = async <TRow = unknown>(
    str: string,
    knex: Knex<any, any[]>,
    params?: any[]
): Promise<TRow | undefined> => {
    const results = await knexRaw<TRow>(str, knex, params)
    if (results.length === 0) return undefined
    return results[0]
}

/**
 *  In the backporting workflow, the users create gdoc posts for posts. As long as these are not yet published,
 *  we still want to bake them from the WP posts. Once the users presses publish there though, we want to stop
 *  baking them from the wordpress post. This funciton fetches all the slugs of posts that have been published via gdocs,
 *  to help us exclude them from the baking process.
 */
export const getSlugsWithPublishedGdocsSuccessors = async (
    knex: Knex<any, any[]>
): Promise<Set<string>> => {
    return knexRaw(
        `-- sql
            select slug from posts_with_gdoc_publish_status
            where isGdocPublished = TRUE`,
        knex
    ).then((rows) => new Set(rows.map((row: any) => row.slug)))
}

export const getExplorerTags = async (
    knex: Knex<any, any[]>
): Promise<{ slug: string; tags: DbChartTagJoin[] }[]> => {
    return knexRaw<{ slug: string; tags: string }>(
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
            ext.explorerSlug`,
        knex
    ).then((rows) =>
        rows.map((row) => ({
            slug: row.slug,
            tags: JSON.parse(row.tags) as DbChartTagJoin[],
        }))
    )
}

export const getPublishedExplorersBySlug = async (
    knex: Knex<any, any[]>
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
        `-- sql
        SELECT
            slug,
            config->>"$.explorerTitle" as title,
            config->>"$.explorerSubtitle" as subtitle
        FROM
            explorers
        WHERE
            isPublished = TRUE`,
        knex
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

export const getLatestDataInsights = (
    limit = 5
): Promise<MinimalDataInsightInterface[]> => {
    return knexRaw(
        `
        SELECT
            content->>'$.title' AS title,
            publishedAt,
            ROW_NUMBER() OVER (ORDER BY publishedAt DESC) - 1 AS \`index\`
        FROM posts_gdocs
        WHERE content->>'$.type' = '${OwidGdocType.DataInsight}'
            AND published = TRUE
            AND publishedAt < NOW()
        ORDER BY publishedAt DESC
        LIMIT ?
        `,
        knexInstance(),
        [limit]
    ).then((results) =>
        results.map((record: any) => ({
            ...record,
            index: Number(record.index),
        }))
    ) as Promise<MinimalDataInsightInterface[]>
}

export const getPublishedDataInsightCount = (): Promise<number> => {
    return knexRawFirst<{ count: number }>(
        `
        SELECT COUNT(*) AS count
        FROM posts_gdocs
        WHERE content->>'$.type' = '${OwidGdocType.DataInsight}'
            AND published = TRUE
            AND publishedAt < NOW()`,
        knexInstance()
    ).then((res) => res?.count ?? 0)
}

export const getTotalNumberOfCharts = (): Promise<number> => {
    return knexRawFirst<{ count: number }>(
        `
        SELECT COUNT(*) AS count
        FROM charts
        WHERE config->"$.isPublished" = TRUE`,
        knexInstance()
    ).then((res) => res?.count ?? 0)
}

export const getTotalNumberOfInUseGrapherTags = (): Promise<number> => {
    return knexRawFirst<{ count: number }>(
        `
        SELECT COUNT(DISTINCT(tagId)) AS count
        FROM chart_tags
        WHERE chartId IN (
        SELECT id
        FROM charts
        WHERE publishedAt IS NOT NULL)`,
        knexInstance()
    ).then((res) => res?.count ?? 0)
}
