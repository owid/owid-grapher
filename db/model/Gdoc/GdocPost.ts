import {
    type OwidGdocPostContent,
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocType,
    OwidEnrichedGdocBlock,
    RawBlockText,
    RelatedChart,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    ArchiveContext,
    LatestPageItem,
    PostsGdocsTableName,
} from "@ourworldindata/types"
import { excludeNullish, formatDate } from "@ourworldindata/utils"
import {
    formatCitation,
    generateStickyNav,
    generateToc,
} from "./archieToEnriched.js"
import { parseFaqs } from "./rawToEnriched.js"
import { htmlToEnrichedTextBlock } from "./htmlToEnriched.js"
import { GdocBase } from "./GdocBase.js"
import { KnexReadonlyTransaction, knexRaw } from "../../db.js"
import { getLatestChartArchivedVersionsIfEnabled } from "../archival/archivalDb.js"
import * as db from "../../db.js"
import { BLOG_POSTS_PER_PAGE } from "../../../settings/serverSettings.js"
import { GdocAnnouncement } from "./GdocAnnouncement.js"
import { GdocDataInsight } from "./GdocDataInsight.js"
import { gdocFromJSON } from "./GdocFactory.js"

export class GdocPost extends GdocBase implements OwidGdocPostInterface {
    declare content: OwidGdocPostContent

    constructor(id?: string) {
        super(id)
        this.content = {
            authors: ["Our World in Data team"],
        }
    }
    static create(obj: OwidGdocBaseInterface): GdocPost {
        const gdoc = new GdocPost()
        Object.assign(gdoc, obj)
        return gdoc
    }
    override linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    relatedCharts: RelatedChart[] = []

    protected override typeSpecificFilenames(): string[] {
        return excludeNullish([
            this.content["cover-image"],
            this.content["featured-image"],
        ])
    }

    override _getSubclassEnrichedBlocks = (
        gdoc: this
    ): OwidEnrichedGdocBlock[] => {
        const enrichedBlocks: OwidEnrichedGdocBlock[] = []

        // TODO: GdocFaq should be its own subclass, requires refactor of admin gdoc registration process
        const parsedFaqs = gdoc.content.parsedFaqs
        if (parsedFaqs) {
            for (const faq of Object.values(parsedFaqs)) {
                enrichedBlocks.push(...faq.content)
            }
        }

        if (gdoc.content.refs?.definitions) {
            const refBlocks = Object.values(
                gdoc.content.refs.definitions
            ).flatMap((definition) => definition.content)
            enrichedBlocks.push(...refBlocks)
        }

        const deprecationNotice = gdoc.content["deprecation-notice"]
        if (deprecationNotice) {
            enrichedBlocks.push(...deprecationNotice)
        }

        return enrichedBlocks
    }

    override _enrichSubclassContent = (content: Record<string, any>): void => {
        const isTocForSidebar = content["sidebar-toc"]
        content.toc = generateToc(content.body, isTocForSidebar)

        if (content.summary) {
            content.summary = content.summary.map((html: RawBlockText) =>
                htmlToEnrichedTextBlock(html.value)
            )
        }

        content.citation = formatCitation(content.citation)

        content["sticky-nav"] = generateStickyNav(content as any)

        if (content.faqs && Object.values(content.faqs).length) {
            const faqResults = parseFaqs(content.faqs, this.id)
            content.parsedFaqs = faqResults.faqs
        }
    }

    override _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []

        if (!this.tags?.length) {
            if (
                this.content.type &&
                ![OwidGdocType.Fragment, OwidGdocType.AboutPage].includes(
                    this.content.type
                )
            ) {
                errors.push({
                    property: "content",
                    message:
                        "Article has no tags set. We won't be able to connect this article to datapages.",
                    type: OwidGdocErrorMessageType.Warning,
                })
            }
            if (this.hasAllChartsBlock) {
                errors.push({
                    property: "content",
                    message: "Tags must be set for all-charts block",
                    type: OwidGdocErrorMessageType.Error,
                })
            }
        }

        const faqs = this.content.faqs
        const parsedFaqs = faqs
            ? parseFaqs(this.content.faqs, this.id)
            : undefined
        // Only validate faqs if they were actually specified
        if (parsedFaqs) {
            for (const parseError of parsedFaqs.parseErrors) {
                errors.push({
                    ...parseError,
                    property: "faqs",
                    type: OwidGdocErrorMessageType.Error,
                })
            }
        }

        return errors
    }

    override _loadSubclassAttachments: (
        knex: KnexReadonlyTransaction
    ) => Promise<void> = (knex: KnexReadonlyTransaction): Promise<void> =>
        this.loadRelatedCharts(knex)

    async loadRelatedCharts(
        knex: KnexReadonlyTransaction,
        archivedVersions?: Record<number, ArchiveContext | undefined>
    ): Promise<void> {
        if (!this.tags?.length || !this.hasAllChartsBlock) return

        const relatedCharts = await knexRaw<{
            chartId: number
            slug: string
            title: string
            variantName: string
            keyChartLevel: number
        }>(
            knex,
            `-- sql
                SELECT DISTINCT
                    charts.id AS chartId,
                    chart_configs.slug,
                    chart_configs.full->>"$.title" AS title,
                    chart_configs.full->>"$.variantName" AS variantName,
                    chart_tags.keyChartLevel
                FROM charts
                JOIN chart_configs ON charts.configId=chart_configs.id
                INNER JOIN chart_tags ON charts.id=chart_tags.chartId
                WHERE chart_tags.tagId IN (?)
                    AND chart_configs.full->>"$.isPublished" = "true"
                ORDER BY title ASC
            `,
            [this.tags.map((tag) => tag.id)]
        )
        archivedVersions ??= await getLatestChartArchivedVersionsIfEnabled(
            knex,
            relatedCharts.map((c) => c.chartId)
        )

        this.relatedCharts = relatedCharts.map((chart) => ({
            ...chart,
            archiveContext: archivedVersions[chart.chartId] || undefined,
        }))
    }
}

function gdocToLatestItem(
    gdoc: GdocPost | GdocAnnouncement | GdocDataInsight
): LatestPageItem {
    if (gdoc instanceof GdocPost) {
        return {
            type: OwidGdocType.Article,
            data: {
                id: gdoc.id,
                title: gdoc.content.title ?? "",
                slug: gdoc.slug,
                authors: gdoc.content.authors,
                publishedAt: formatDate(gdoc.publishedAt!),
                published: gdoc.published,
                subtitle: gdoc.content.subtitle ?? "",
                excerpt: gdoc.content.excerpt ?? "",
                type: OwidGdocType.Article,
                "featured-image": gdoc.content["featured-image"],
            },
        }
    } else if (gdoc instanceof GdocDataInsight) {
        return {
            type: OwidGdocType.DataInsight,
            data: {
                id: gdoc.id,
                slug: gdoc.slug,
                publishedAt: gdoc.publishedAt,
                content: gdoc.content,
            },
        }
    } else {
        return {
            type: OwidGdocType.Announcement,
            data: gdoc,
        }
    }
}

export const getLatestPageItems = async (
    knex: db.KnexReadonlyTransaction,
    pageNum: number = 1,
    includeTypes: OwidGdocType[] = []
): Promise<{
    items: LatestPageItem[]
    pagination: {
        pageNum: number
        totalPages: number
    }
}> => {
    const rawResults = await db.knexRaw<Record<string, any>>(
        knex,
        `-- sql
            SELECT
                pg.*,
                COUNT(*) OVER() as totalRecords
            FROM ${PostsGdocsTableName} pg
            WHERE pg.published = TRUE
            AND pg.publishedAt <= NOW()
            ${includeTypes.length ? `AND pg.type IN (:types)` : ""}
            AND pg.publicationContext = 'listed'
            ORDER BY pg.publishedAt DESC
            LIMIT 10 OFFSET :offset
            `,
        {
            types: includeTypes,
            offset: (pageNum - 1) * BLOG_POSTS_PER_PAGE,
        }
    )

    const items = rawResults
        .map(gdocFromJSON)
        .map((gdoc) =>
            gdocToLatestItem(
                gdoc as GdocPost | GdocAnnouncement | GdocDataInsight
            )
        )
    const totalRecords = rawResults.length > 0 ? rawResults[0].totalRecords : 0
    const totalPages = Math.ceil(totalRecords / BLOG_POSTS_PER_PAGE)
    return { items, pagination: { pageNum, totalPages } }
}
