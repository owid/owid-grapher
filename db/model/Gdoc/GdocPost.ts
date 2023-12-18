import { Entity, Column, LessThanOrEqual } from "typeorm"
import {
    type OwidGdocPostContent,
    OwidGdocPostInterface,
    OwidGdocPublished,
    OwidGdocPublicationContext,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    DetailDictionary,
    ParseError,
    OwidGdocType,
    OwidEnrichedGdocBlock,
    RawBlockText,
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

@Entity("posts_gdocs")
export class GdocPost extends GdocBase implements OwidGdocPostInterface {
    @Column({ default: "{}", type: "json" }) content!: OwidGdocPostContent

    constructor(id?: string) {
        super(id)
        this.content = {
            authors: ["Our World in Data team"],
        }
    }

    linkedDocuments: Record<string, OwidGdocPostInterface> = {}
    _filenameProperties = ["cover-image", "featured-image"]

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

    _validateSubclass = async (): Promise<OwidGdocErrorMessage[]> => {
        const errors: OwidGdocErrorMessage[] = []

        if (!this.tags.length) {
            if (this.content.type !== OwidGdocType.Fragment) {
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
            const { details } = await GdocPost.getDetailsOnDemandGdoc()
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

    static async getDetailsOnDemandGdoc(): Promise<{
        details: DetailDictionary
        parseErrors: ParseError[]
    }> {
        if (!GDOCS_DETAILS_ON_DEMAND_ID) {
            console.error(
                "GDOCS_DETAILS_ON_DEMAND_ID unset. No details can be loaded"
            )
            return { details: {}, parseErrors: [] }
        }
        const gdoc = await GdocPost.findOne({
            where: {
                id: GDOCS_DETAILS_ON_DEMAND_ID,
                published: true,
            },
        })

        if (!gdoc) {
            return {
                details: {},
                parseErrors: [
                    {
                        message: `Details on demand document with id "${GDOCS_DETAILS_ON_DEMAND_ID}" isn't registered and/or published. Please add it via ${ADMIN_BASE_URL}/admin/gdocs`,
                    },
                ],
            }
        }

        return parseDetails(gdoc.content.details)
    }

    static async getPublishedGdocs(): Promise<
        (GdocPost & OwidGdocPublished)[]
    > {
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
        return GdocPost.find({
            where: {
                published: true,
                publishedAt: LessThanOrEqual(new Date()),
            },
            relations: ["tags"],
        }).then((gdocs) =>
            gdocs.filter(
                ({ content: { type } }) =>
                    type &&
                    [
                        OwidGdocType.Article,
                        OwidGdocType.TopicPage,
                        OwidGdocType.LinearTopicPage,
                    ].includes(type)
            )
        ) as Promise<(OwidGdocPublished & GdocPost)[]>
    }

    /**
     * Excludes published listed Gdocs with a publication date in the future
     */
    static async getListedGdocs(): Promise<(GdocPost & OwidGdocPublished)[]> {
        return GdocPost.findBy({
            published: true,
            publicationContext: OwidGdocPublicationContext.listed,
            publishedAt: LessThanOrEqual(new Date()),
        }) as Promise<(GdocPost & OwidGdocPublished)[]>
    }
}
