import { type docs_v1 } from "@googleapis/docs"
import { type OwidGdocPostContent } from "@ourworldindata/utils"
import { archieToEnriched } from "./archieToEnriched.js"
import { documentToParagraphs } from "./gdocAstToParagraphs.js"
import { paragraphsToArchieText } from "./paragraphsToArchie.js"

export function gdocAstToEnriched(
    document: docs_v1.Schema$Document,
    additionalEnrichmentFunction: (
        content: Record<string, unknown>
    ) => void = () => undefined
): OwidGdocPostContent {
    const paragraphs = documentToParagraphs(document)
    const archieText = paragraphsToArchieText(paragraphs)
    return archieToEnriched(archieText, additionalEnrichmentFunction)
}
