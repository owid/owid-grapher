import { Entity, Column } from "typeorm"
import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidEnrichedGdocBlock,
    FaqDictionary,
    ParseError,
} from "@ourworldindata/utils"
import { parseFaqs } from "./rawToEnriched.js"
import { GdocBase } from "./GdocBase.js"

interface InterfaceGdocFaq {
    parsedFaqs: FaqDictionary
    parseErrors: ParseError[]
    faqs: unknown // unparsed
}

/**
 * This is an unused mock prototype, I think *something* like this could work,
 * but we'd need a different code path for registering FAQs through the server
 * instead of using the same endpoint for both posts and faqs.
 * For now, we'll just use the GdocPost class.
 */
@Entity("posts_gdocs")
export class GdocFaq extends GdocBase {
    static table = "posts_gdocs"
    @Column({ default: "{}", type: "json" }) content!: InterfaceGdocFaq

    constructor(id?: string) {
        super()
        if (id) {
            this.id = id
        }
    }
    _omittableFields: string[] = ["content.parseErrors, content.faqs"]

    _enrichSubclassContent = (content: Record<string, any>): void => {
        if (content.faqs) {
            const faqResults = parseFaqs(content.faqs, this.id)
            content.parsedFaqs = faqResults.faqs
            content.parseErrors = faqResults.parseErrors
        }
    }

    _validateSubclass = (): OwidGdocErrorMessage[] => {
        const errors: OwidGdocErrorMessage[] = []

        for (const parseError of this.content.parseErrors) {
            errors.push({
                ...parseError,
                property: "faqs",
                type: OwidGdocErrorMessageType.Error,
            })
        }

        return errors
    }

    _getSubclassEnrichedBlocks = (gdoc: this): OwidEnrichedGdocBlock[] => {
        const enrichedBlocks: OwidEnrichedGdocBlock[] = []

        for (const faq of Object.values(gdoc.content.parsedFaqs)) {
            enrichedBlocks.push(...faq.content)
        }

        return enrichedBlocks
    }
}
