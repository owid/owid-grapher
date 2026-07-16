import {
    type OwidGdocPostContent,
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocType,
    OwidEnrichedGdocBlock,
    RelatedChart,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    ArchiveContext,
} from "@ourworldindata/types"
import { excludeNullish, generateToc } from "@ourworldindata/utils"
import { formatCitation, generateStickyNav } from "./archieToEnriched.js"
import { parseFaqs, parseLatestFeedExcerpt } from "./rawToEnriched.js"
import { GdocBase } from "./GdocBase.js"
import { KnexReadonlyTransaction, knexRaw } from "../../db.js"
import { getLatestArchivedChartPageVersionsIfEnabled } from "../ArchivedChartVersion.js"

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
            this.content["latest-feed-featured-image"],
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

        const latestFeedExcerpt = gdoc.content["latest-feed-excerpt"]
        if (latestFeedExcerpt) {
            enrichedBlocks.push(...latestFeedExcerpt)
        }

        return enrichedBlocks
    }

    override _enrichSubclassContent = (content: Record<string, any>): void => {
        const isTocForSidebar = content["sidebar-toc"]
        const isLinearTopicPage = content.type === OwidGdocType.LinearTopicPage
        content.toc = generateToc(
            content.body,
            isTocForSidebar || isLinearTopicPage,
            content.type as OwidGdocType
        )

        if (content["latest-feed-excerpt"]) {
            content["latest-feed-excerpt"] = parseLatestFeedExcerpt(
                content["latest-feed-excerpt"]
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

        const latestFeedExcerpt = this.content["latest-feed-excerpt"]
        if (latestFeedExcerpt) {
            for (const block of latestFeedExcerpt) {
                for (const parseError of block.parseErrors) {
                    errors.push({
                        message: `Parse error in latest-feed-excerpt: ${parseError.message}`,
                        property: "latest-feed-excerpt",
                        type: parseError.isWarning
                            ? OwidGdocErrorMessageType.Warning
                            : OwidGdocErrorMessageType.Error,
                    })
                }
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
        archivedVersions ??= await getLatestArchivedChartPageVersionsIfEnabled(
            knex,
            relatedCharts.map((c) => c.chartId)
        )

        this.relatedCharts = relatedCharts.map((chart) => ({
            ...chart,
            archiveContext: archivedVersions[chart.chartId] || undefined,
        }))
    }
}
