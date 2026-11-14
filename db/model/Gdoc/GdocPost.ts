import {
    type OwidGdocPostContent,
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocType,
    OwidEnrichedGdocBlock,
    OwidGdocMinimalPostInterface,
    OwidGdocBaseInterface,
} from "@ourworldindata/types"
import { excludeNullish, generateToc } from "@ourworldindata/utils"
import {
    formatCitation,
    generateStickyNav,
    parseAcknowledgements,
    parseContributors,
    parseFaqs,
    parseLatestFeedExcerpt,
} from "@ourworldindata/gdoc-pipeline"
import { GdocBase } from "./GdocBase.js"

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

        const acknowledgements = gdoc.content.acknowledgements
        if (acknowledgements) {
            enrichedBlocks.push(...acknowledgements)
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

        if (content.contributors !== undefined) {
            const { contributors, contributorRoles } = parseContributors(
                content.contributors
            )
            content.contributors = contributors
            content.contributorRoles = contributorRoles
        }

        if (content.acknowledgements) {
            content.acknowledgements = parseAcknowledgements(
                content.acknowledgements
            )
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
}
