import { type docs_v1 } from "@googleapis/docs"
import { type OwidGdocPostContent } from "@ourworldindata/utils"
import { archieParsedToEnriched, extractRefs } from "./archieToEnriched.js"
import { parseBodyParagraphBlocks } from "./archieParagraphBlockParser.js"
import { loadArchieFromLines } from "./archieLineParser.js"
import { documentToParagraphs } from "./gdocAstToParagraphs.js"
import { attachSourceMetadata } from "./gdocSourceMetadata.js"
import { paragraphBlocksToRawBody } from "./paragraphBlocksToRaw.js"
import { paragraphsToArchieText } from "./paragraphsToArchie.js"
import { buildRefIdToNumberMap } from "./refSyntax.js"

function splitArchieLines(text: string): string[] {
    const normalized = text.replace(/\r/g, "")
    return normalized.split("\n")
}

export function gdocAstToEnriched(
    document: docs_v1.Schema$Document,
    additionalEnrichmentFunction: (
        content: Record<string, unknown>
    ) => void = () => undefined
): OwidGdocPostContent {
    const paragraphs = documentToParagraphs(document)
    const archieText = paragraphsToArchieText(paragraphs)
    const { extractedText, refsByFirstAppearance, rawInlineRefs } =
        extractRefs(archieText)

    // Replace whitespace-only inside links. We need to keep the WS around, they
    // just should not be displayed as links
    const noWSOnlyLinks = extractedText.replace(
        /(<a[^>]*>)(\s+)(<\/a>)/gims,
        "$2"
    )
    // Replace leading whitespace inside links. We need to keep the WS around, they
    // just should not be displayed as links
    const noLeadingWSLinks = noWSOnlyLinks.replace(
        /(<a[^>]*>)(\s+)(.*?)(<\/a>)/gims,
        "$2$1$3$4"
    )

    const lines = splitArchieLines(noLeadingWSLinks)
    const parsedUnsanitized = loadArchieFromLines(lines)
    const refIdToNumber = buildRefIdToNumberMap(refsByFirstAppearance)
    const { blocks: paragraphBlocks } = parseBodyParagraphBlocks(paragraphs)
    parsedUnsanitized.body = paragraphBlocksToRawBody(
        paragraphs,
        paragraphBlocks,
        refIdToNumber
    )

    const content = archieParsedToEnriched(
        parsedUnsanitized,
        refsByFirstAppearance,
        rawInlineRefs,
        additionalEnrichmentFunction
    )

    attachSourceMetadata(content.body, paragraphBlocks)

    return content
}
