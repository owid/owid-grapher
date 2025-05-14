import {
    type OwidGdocPostContent,
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    ParseError,
    OwidGdocType,
    OwidEnrichedGdocBlock,
    RawBlockText,
    RelatedChart,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    excludeNullish,
    DEPRECATED_DetailDictionary,
} from "@ourworldindata/utils"
import { GDOCS_DETAILS_ON_DEMAND_ID } from "../../../settings/serverSettings.js"
import {
    formatCitation,
    generateStickyNav,
    generateToc,
} from "./archieToEnriched.js"
import { ADMIN_BASE_URL } from "../../../settings/clientSettings.js"
import { DEPRECATED_parseDetails, parseFaqs } from "./rawToEnriched.js"
import { htmlToEnrichedTextBlock } from "./htmlToEnriched.js"
import { GdocBase } from "./GdocBase.js"
import {
    KnexReadonlyTransaction,
    getParsedDodsDictionary,
    knexRaw,
} from "../../db.js"
import { getGdocBaseObjectById } from "./GdocFactory.js"

export class GdocPost extends GdocBase implements OwidGdocPostInterface {
    content!: OwidGdocPostContent

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
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface> = {}
    relatedCharts: RelatedChart[] = []

    protected typeSpecificFilenames(): string[] {
        return excludeNullish([
            this.content["cover-image"],
            this.content["featured-image"],
        ])
    }

    _getSubclassEnrichedBlocks = (gdoc: this): OwidEnrichedGdocBlock[] => {
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

    _enrichSubclassContent = (content: Record<string, any>): void => {
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

    _validateSubclass = async (
        knex: KnexReadonlyTransaction
    ): Promise<OwidGdocErrorMessage[]> => {
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

        const parsedDods = await getParsedDodsDictionary(knex)

        for (const detailId of this.details) {
            if (!parsedDods[detailId]) {
                errors.push({
                    type: OwidGdocErrorMessageType.Error,
                    message: `Invalid DoD referenced: "${detailId}"`,
                    property: "content",
                })
            }
        }

        return errors
    }

    _loadSubclassAttachments: (knex: KnexReadonlyTransaction) => Promise<void> =
        (knex: KnexReadonlyTransaction): Promise<void> =>
            this.loadRelatedCharts(knex)

    async loadRelatedCharts(knex: KnexReadonlyTransaction): Promise<void> {
        if (!this.tags?.length || !this.hasAllChartsBlock) return

        const relatedCharts = await knexRaw<{
            slug: string
            title: string
            variantName: string
            keyChartLevel: number
        }>(
            knex,
            `-- sql
                SELECT DISTINCT
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

        this.relatedCharts = relatedCharts
    }

    /**
     * Replaced by the dods admin, but needed for the migration
     */
    static async DEPRECATED_getDetailsOnDemandGdoc(
        knex: KnexReadonlyTransaction
    ): Promise<{
        details: DEPRECATED_DetailDictionary
        parseErrors: ParseError[]
    }> {
        if (!GDOCS_DETAILS_ON_DEMAND_ID) {
            console.error(
                "GDOCS_DETAILS_ON_DEMAND_ID unset. No details can be loaded"
            )
            return { details: {}, parseErrors: [] }
        }
        const gdoc = await getGdocBaseObjectById(
            knex,
            GDOCS_DETAILS_ON_DEMAND_ID,
            false,
            true
        )

        if (!gdoc || !("details" in gdoc.content)) {
            return {
                details: {},
                parseErrors: [
                    {
                        message: `Details on demand document with id "${GDOCS_DETAILS_ON_DEMAND_ID}" isn't registered and/or published; or it does not contain a [.details] block. Please add it via ${ADMIN_BASE_URL}/admin/gdocs`,
                    },
                ],
            }
        }

        return DEPRECATED_parseDetails(gdoc.content.details)
    }
}
