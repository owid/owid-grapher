import * as _ from "lodash-es"
import {
    DbRawPostGdoc,
    OwidGdocType,
    OwidGdocPublicationContext,
    OwidGdocMinimalPostInterface,
    OwidGdocIndexItem,
    LatestDataInsight,
    OwidGdocBaseInterface,
    DbPlainTag,
    formatDate,
    parsePostsGdocsRow,
    extractGdocIndexItem,
    DATA_INSIGHTS_INDEX_PAGE_SIZE,
    ARCHVED_THUMBNAIL_FILENAME,
    traverseEnrichedBlock,
    PostsGdocsTableName,
    OwidGdocTypeMap,
} from "@ourworldindata/utils"
import {
    KnexReadonlyTransaction,
    knexRaw,
    getTagHierarchiesByChildName,
    getBestBreadcrumbs,
    getImageMetadataByFilenames,
} from "../../db.js"
import { GdocBase } from "./GdocBase.js"
import { loadGdocFromGdocBase } from "./GdocFactory.js"
import { extractFilenamesFromBlock } from "./gdocUtils.js"
import { Knex } from "knex"

export interface GdocQueryOptions {
    // Filtering
    types?: OwidGdocType[]
    published?: boolean
    publishedBeforeNow?: boolean
    publicationContext?: OwidGdocPublicationContext
    topicSlug?: string
    ids?: string[]

    // Sorting
    orderBy?: "publishedAt" | "updatedAt"
    orderDirection?: "asc" | "desc"

    // Pagination
    pagination?: {
        limit: number
        offset: number
    }

    // Data loading
    loadTags?: boolean
    loadBreadcrumbs?: boolean

    // Output format
    outputFormat?: "minimal" | "base" | "index" | "full" | "latest-insights"
}

export interface GdocQueryResult<T> {
    data: T[]
    totalCount?: number
    hasMore?: boolean
}

/**
 * Centralized query builder for posts_gdocs table operations.
 * Provides a consistent interface for filtering, sorting, and loading Gdoc data.
 */
export class GdocQueryBuilder {
    private knex: KnexReadonlyTransaction
    private options: GdocQueryOptions

    constructor(knex: KnexReadonlyTransaction, options: GdocQueryOptions = {}) {
        this.knex = knex
        this.options = {
            published: true,
            publishedBeforeNow: true,
            orderBy: "publishedAt",
            orderDirection: "desc",
            loadTags: false,
            loadBreadcrumbs: false,
            outputFormat: "base",
            ...options,
        }
    }

    private buildQueryWithFilters(): Knex.QueryBuilder<
        DbRawPostGdoc,
        DbRawPostGdoc[]
    > {
        let query = this.knex<DbRawPostGdoc>(PostsGdocsTableName)

        // Type filtering
        if (this.options.types?.length) {
            query = query.whereIn("type", this.options.types)
        }

        // Published status
        if (this.options.published !== undefined) {
            query = query.where("published", this.options.published ? 1 : 0)
        }

        // Published before now
        if (this.options.publishedBeforeNow) {
            query = query.where("publishedAt", "<=", this.knex.fn.now())
        }

        // Publication context
        if (this.options.publicationContext !== undefined) {
            query = query.where(
                "publicationContext",
                this.options.publicationContext
            )
        }

        // Specific IDs
        if (this.options.ids?.length) {
            query = query.whereIn("id", this.options.ids)
        }

        // Topic filtering (requires join)
        if (this.options.topicSlug) {
            query = query
                .join(
                    "posts_gdocs_x_tags as pgt",
                    `${PostsGdocsTableName}.id`,
                    "pgt.gdocId"
                )
                .join("tags", "pgt.tagId", "tags.id")
                .where("tags.slug", this.options.topicSlug)
                .distinct()
        }

        // Ordering
        if (this.options.orderBy) {
            query = query.orderBy(
                this.options.orderBy,
                this.options.orderDirection
            )
        }

        // Pagination
        if (this.options.pagination) {
            query = query.limit(this.options.pagination.limit)
            query = query.offset(this.options.pagination.offset)
        }

        return query
    }

    private async loadTagsForGdocs(
        gdocIds: string[]
    ): Promise<Record<string, DbPlainTag[]>> {
        if (!gdocIds.length) return {}

        const tags = await knexRaw<DbPlainTag & { gdocId: string }>(
            this.knex,
            `-- sql
                SELECT gt.gdocId as gdocId, tags.*
                FROM tags
                JOIN posts_gdocs_x_tags gt ON gt.tagId = tags.id
                WHERE gt.gdocId in (:ids)`,
            { ids: gdocIds }
        )

        return _.groupBy(tags, "gdocId")
    }

    async getMinimal(): Promise<GdocQueryResult<OwidGdocMinimalPostInterface>> {
        const query = this.buildQueryWithFilters()

        const rows = await query.select(
            this.knex.raw(
                `-- sql
                id,
                slug,
                authors,
                publishedAt,
                published,
                type,
                content ->> '$.title' as title,
                content ->> '$.subtitle' as subtitle,
                content ->> '$.excerpt' as excerpt,
                CASE
                    WHEN content ->> '$."deprecation-notice"' IS NOT NULL THEN ?
                    ELSE content ->> '$."featured-image"'
                END as "featured-image"
                `,
                [ARCHVED_THUMBNAIL_FILENAME]
            )
        )

        const data = rows.map((row: any) => ({
            id: row.id,
            title: row.title,
            slug: row.slug,
            authors: JSON.parse(row.authors || "[]") as string[],
            publishedAt: row.publishedAt ? formatDate(row.publishedAt) : null,
            published: !!row.published,
            subtitle: row.subtitle,
            excerpt: row.excerpt,
            type: row.type as OwidGdocType,
            "featured-image": row["featured-image"] || "",
        }))

        return { data }
    }

    /**
     * Execute the query and return base Gdoc objects
     */
    async getBase(): Promise<GdocQueryResult<OwidGdocBaseInterface>> {
        const rows = await this.buildQueryWithFilters().select(
            `${PostsGdocsTableName}.*`
        )
        if (!rows.length) return { data: [] }

        const enrichedRows = rows.map(parsePostsGdocsRow)
        const data: OwidGdocBaseInterface[] = enrichedRows.map((row) => ({
            ...row,
            tags: null,
            breadcrumbs: null,
        }))

        // Load tags if requested
        if (this.options.loadTags || this.options.loadBreadcrumbs) {
            const groupedTags = await this.loadTagsForGdocs(
                rows.map((r) => r.id)
            )

            for (const gdoc of data) {
                gdoc.tags = groupedTags[gdoc.id] || null
            }

            // Load breadcrumbs if requested
            if (this.options.loadBreadcrumbs) {
                const tagHierarchiesByChildName =
                    await getTagHierarchiesByChildName(this.knex)
                for (const gdoc of data) {
                    if (gdoc.tags?.length) {
                        gdoc.breadcrumbs = getBestBreadcrumbs(
                            gdoc.tags,
                            tagHierarchiesByChildName
                        )
                    }
                }
            }
        }

        return { data }
    }

    /**
     * Execute the query and return index items
     */
    async toIndex(): Promise<GdocQueryResult<OwidGdocIndexItem>> {
        const baseResult = await this.getBase()
        const data = baseResult.data.map(extractGdocIndexItem)
        return { data }
    }

    /**
     * Execute the query and return full Gdoc class instances
     */
    async toFull(): Promise<GdocQueryResult<GdocBase>> {
        const baseResult = await this.getBase()
        if (!baseResult.data.length) return { data: [] }

        const data = await Promise.all(
            baseResult.data.map((row) => loadGdocFromGdocBase(this.knex, row))
        )

        return { data }
    }

    /**
     * Execute the query and return data insight format
     */
    async toLatestInsights(): Promise<{
        dataInsights: LatestDataInsight[]
        imageMetadata: Record<string, any>
    }> {
        const rows = await this.buildQueryWithFilters().select(
            `${PostsGdocsTableName}.*`
        )

        const dataInsights = rows.map((row) => {
            const parsed = parsePostsGdocsRow(row)
            return {
                id: parsed.id,
                slug: parsed.slug,
                publishedAt: parsed.publishedAt,
                content: parsed.content,
            } as LatestDataInsight
        })

        // Extract filenames from all data insights
        const filenames = new Set<string>()
        for (const dataInsight of dataInsights) {
            if (dataInsight.content?.body) {
                for (const block of dataInsight.content.body) {
                    traverseEnrichedBlock(block, (b) => {
                        for (const filename of extractFilenamesFromBlock(b)) {
                            filenames.add(filename)
                        }
                    })
                }
            }
        }

        const imageMetadata = await getImageMetadataByFilenames(this.knex, [
            ...filenames,
        ])

        return {
            dataInsights,
            imageMetadata,
        }
    }

    /**
     * Execute the query based on the output format
     */
    async execute(): Promise<GdocQueryResult<any>> {
        switch (this.options.outputFormat) {
            case "minimal":
                return this.getMinimal()
            case "base":
                return this.getBase()
            case "index":
                return this.toIndex()
            case "full":
                return this.toFull()
            case "latest-insights":
                // This returns a different format, so we handle it separately
                throw new Error("Use toLatestInsights() method for this format")
            default:
                return this.getBase()
        }
    }
}

export class GdocQuery {
    static publishedOfTypes(
        knex: KnexReadonlyTransaction,
        types: OwidGdocType[],
        options?: Partial<GdocQueryOptions>
    ): GdocQueryBuilder {
        return new GdocQueryBuilder(knex, {
            types,
            published: true,
            publishedBeforeNow: true,
            loadTags: true,
            ...options,
        })
    }

    static dataInsights(
        knex: KnexReadonlyTransaction,
        topicSlug?: string,
        options?: Partial<GdocQueryOptions>
    ): GdocQueryBuilder {
        return new GdocQueryBuilder(knex, {
            types: [OwidGdocType.DataInsight],
            published: true,
            publishedBeforeNow: true,
            topicSlug,
            ...options,
        })
    }

    static listedPosts(
        knex: KnexReadonlyTransaction,
        options?: Partial<GdocQueryOptions>
    ): GdocQueryBuilder {
        return new GdocQueryBuilder(knex, {
            types: [
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
            ],
            published: true,
            publishedBeforeNow: true,
            publicationContext: OwidGdocPublicationContext.listed,
            loadTags: true,
            ...options,
        })
    }

    static publishedAuthors(
        knex: KnexReadonlyTransaction,
        options?: Partial<GdocQueryOptions>
    ): GdocQueryBuilder {
        return new GdocQueryBuilder(knex, {
            types: [OwidGdocType.Author],
            published: true,
            ...options,
        })
    }

    static byIds(
        knex: KnexReadonlyTransaction,
        ids: string[],
        options?: Partial<GdocQueryOptions>
    ): GdocQueryBuilder {
        return new GdocQueryBuilder(knex, {
            ids,
            published: false, // Don't filter by published status when querying specific IDs
            publishedBeforeNow: false, // Also don't filter by publication date
            ...options,
        })
    }

    static adminIndex(
        knex: KnexReadonlyTransaction,
        options?: Partial<GdocQueryOptions>
    ): GdocQueryBuilder {
        return new GdocQueryBuilder(knex, {
            orderBy: "updatedAt",
            orderDirection: "desc",
            loadTags: true,
            outputFormat: "index",
            published: undefined, // Admin can see both published and unpublished content
            publishedBeforeNow: false,
            ...options,
        })
    }

    static allPublishedMinimal(
        knex: KnexReadonlyTransaction,
        options?: Partial<GdocQueryOptions>
    ): GdocQueryBuilder {
        return new GdocQueryBuilder(knex, {
            published: true,
            publishedBeforeNow: true,
            outputFormat: "minimal",
            ...options,
        })
    }

    static publishedPosts(
        knex: KnexReadonlyTransaction,
        options?: Partial<GdocQueryOptions>
    ): GdocQueryBuilder {
        return new GdocQueryBuilder(knex, {
            types: [
                OwidGdocType.Article,
                OwidGdocType.LinearTopicPage,
                OwidGdocType.TopicPage,
                OwidGdocType.AboutPage,
            ],
            published: true,
            publishedBeforeNow: true,
            loadTags: true,
            outputFormat: "full",
            ...options,
        })
    }

    static latestDataInsights(
        knex: KnexReadonlyTransaction,
        limit = 7
    ): GdocQueryBuilder {
        return new GdocQueryBuilder(knex, {
            types: [OwidGdocType.DataInsight],
            published: true,
            publishedBeforeNow: true,
            pagination: { limit, offset: 0 },
            orderBy: "publishedAt",
            orderDirection: "desc",
        })
    }
}

export async function fetchGdocs<T extends OwidGdocType>(
    knex: KnexReadonlyTransaction,
    options: GdocQueryOptions & { types: T[] }
): Promise<OwidGdocTypeMap[T][]> {
    const result = await new GdocQueryBuilder(knex, options).execute()
    return result.data as OwidGdocTypeMap[T][]
}
