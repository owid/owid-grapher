import {
    type OwidGdocPostContent,
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    DetailDictionary,
    ParseError,
    OwidGdocType,
    OwidEnrichedGdocBlock,
    RawBlockText,
    RelatedChart,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
    excludeNullish,
} from "@ourworldindata/utils"
import { GDOCS_DETAILS_ON_DEMAND_ID } from "../../../settings/serverSettings.js"
import {
    formatCitation,
    generateStickyNav,
    generateToc,
} from "./archieToEnriched.js"
import { ADMIN_BASE_URL } from "../../../settings/clientSettings.js"
import { parseDetails, parseFaqs } from "./rawToEnriched.js"
import { htmlToEnrichedTextBlock } from "./htmlToEnriched.js"
import { GdocBase } from "./GdocBase.js"
import { KnexReadonlyTransaction, knexRaw } from "../../db.js"
import {
    getGdocBaseObjectById,
    getAndLoadPublishedGdocPosts,
} from "./GdocFactory.js"

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

        // Unless this is the DoD document, validate that all referenced dods exist
        if (this.id !== GDOCS_DETAILS_ON_DEMAND_ID) {
            const { details } = await GdocPost.getDetailsOnDemandGdoc(knex)
            for (const detailId of this.details) {
                if (details && !details[detailId]) {
                    errors.push({
                        type: OwidGdocErrorMessageType.Error,
                        message: `Invalid DoD referenced: "${detailId}"`,
                        property: "content",
                    })
                }
            }
        }

        // This is to validate the DoD document itself
        // TODO: this should be done on a GdocDods subclass
        if (this.id === GDOCS_DETAILS_ON_DEMAND_ID) {
            const results = parseDetails(this.content.details)
            for (const parseError of results.parseErrors) {
                errors.push({
                    ...parseError,
                    property: "details",
                    type: OwidGdocErrorMessageType.Error,
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
        charts.config->>"$.slug" AS slug,
        charts.config->>"$.title" AS title,
        charts.config->>"$.variantName" AS variantName,
        chart_tags.keyChartLevel
        FROM charts
        INNER JOIN chart_tags ON charts.id=chart_tags.chartId
        WHERE chart_tags.tagId IN (?)
        AND charts.config->>"$.isPublished" = "true"
        ORDER BY title ASC
        `,
            [this.tags.map((tag) => tag.id)]
        )

        this.relatedCharts = relatedCharts
    }

    static async getDetailsOnDemandGdoc(
        knex: KnexReadonlyTransaction
    ): Promise<{
        details: DetailDictionary
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

        return parseDetails(gdoc.content.details)
    }

    static async getPublishedGdocPosts(
        knex: KnexReadonlyTransaction
    ): Promise<GdocPost[]> {
        // #gdocsvalidation this cast means that we trust the admin code and
        // workflow to provide published articles that have all the required content
        // fields (see #gdocsvalidationclient and pending #gdocsvalidationserver).
        // It also means that if a required field is added after the publication of
        // an article, there won't currently be any checks preventing the then
        // incomplete article to be republished (short of an error being raised down
        // the line). A migration should then be added to update current articles
        // with a sensible default for the new required content field. An
        // alternative would be to encapsulate that default in
        // mapGdocsToWordpressPosts(). This would make the Gdoc entity coming from
        // the database dependent on the mapping function, which is more practical
        // but also makes it less of a source of truth when considered in isolation.
        return getAndLoadPublishedGdocPosts(knex)
    }
}
