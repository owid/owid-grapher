import { type docs_v1 } from "@googleapis/docs"

// ---------------------------------------------------------------------------
// Fixture builder: assembles a docs_v1.Schema$Document from paragraph specs,
// auto-computing Google Docs character indexes (body content starts at 1)
// ---------------------------------------------------------------------------

export interface Segment {
    text?: string
    bold?: boolean
    italic?: boolean
    link?: string
    chip?: { uri: string; title: string }
    image?: boolean
    suggestedInsertion?: boolean
    suggestedDeletion?: boolean
}

export interface ParagraphSpec {
    segments: Array<string | Segment>
    bullet?: boolean
    heading?: number
}

export function para(...segments: Array<string | Segment>): ParagraphSpec {
    return { segments }
}

export function buildDoc(
    specs: Array<string | ParagraphSpec>
): docs_v1.Schema$Document {
    let cursor = 1
    const content: docs_v1.Schema$StructuralElement[] = []

    for (const specOrString of specs) {
        const spec =
            typeof specOrString === "string" ? para(specOrString) : specOrString
        const startIndex = cursor
        const elements: docs_v1.Schema$ParagraphElement[] = []

        for (const segmentOrString of spec.segments) {
            const segment: Segment =
                typeof segmentOrString === "string"
                    ? { text: segmentOrString }
                    : segmentOrString
            const suggestionIds = segment.suggestedInsertion
                ? { suggestedInsertionIds: ["suggest.1"] }
                : segment.suggestedDeletion
                  ? { suggestedDeletionIds: ["suggest.1"] }
                  : {}
            if (segment.chip) {
                elements.push({
                    startIndex: cursor,
                    endIndex: cursor + 1,
                    richLink: {
                        richLinkProperties: {
                            uri: segment.chip.uri,
                            title: segment.chip.title,
                        },
                        ...suggestionIds,
                    },
                })
                cursor += 1
            } else if (segment.image) {
                elements.push({
                    startIndex: cursor,
                    endIndex: cursor + 1,
                    inlineObjectElement: {
                        inlineObjectId: "kix.image",
                        ...suggestionIds,
                    },
                })
                cursor += 1
            } else {
                const text = segment.text ?? ""
                const textStyle: docs_v1.Schema$TextStyle = {}
                if (segment.bold) textStyle.bold = true
                if (segment.italic) textStyle.italic = true
                if (segment.link) textStyle.link = { url: segment.link }
                elements.push({
                    startIndex: cursor,
                    endIndex: cursor + text.length,
                    textRun: { content: text, textStyle, ...suggestionIds },
                })
                cursor += text.length
            }
        }

        // every Google Docs paragraph ends with a newline character; it lives
        // in the last textRun, or in its own run when the paragraph ends with
        // a non-text element
        const last = elements[elements.length - 1]
        if (last?.textRun) {
            last.textRun.content += "\n"
            last.endIndex = (last.endIndex ?? cursor) + 1
        } else {
            elements.push({
                startIndex: cursor,
                endIndex: cursor + 1,
                textRun: { content: "\n", textStyle: {} },
            })
        }
        cursor += 1

        content.push({
            startIndex,
            endIndex: cursor,
            paragraph: {
                elements,
                bullet: spec.bullet ? { listId: "kix.list" } : undefined,
                paragraphStyle: spec.heading
                    ? { namedStyleType: `HEADING_${spec.heading}` }
                    : undefined,
            },
        })
    }

    return { body: { content }, revisionId: "rev-1" }
}

/**
 * Applies insertText/deleteContentRange requests to the doc's character
 * content the way the Docs API would (sequentially, exact indexes), and
 * returns the resulting plain text. Non-text elements (chips, images) are
 * represented by ￼ placeholders so their indexes are accounted for.
 */
export function simulateRequests(
    document: docs_v1.Schema$Document,
    requests: docs_v1.Schema$Request[]
): string {
    const chars: string[] = [] // chars[i] holds the character at doc index i + 1
    for (const element of document.body?.content ?? []) {
        for (const pe of element.paragraph?.elements ?? []) {
            if (pe.textRun) chars.push(...(pe.textRun.content ?? ""))
            else chars.push("￼")
        }
    }
    for (const request of requests) {
        if (request.deleteContentRange) {
            const range = request.deleteContentRange.range!
            chars.splice(
                range.startIndex! - 1,
                range.endIndex! - range.startIndex!
            )
        } else if (request.insertText) {
            chars.splice(
                request.insertText.location!.index! - 1,
                0,
                ...request.insertText.text!
            )
        }
        // updateTextStyle doesn't change text content
    }
    return chars.join("")
}

export function docPlainText(document: docs_v1.Schema$Document): string {
    return simulateRequests(document, [])
}

/**
 * Rebuilds a plain-text document fixture from simulated post-edit text, so
 * that a "re-fetched" document can be handed back to the engine in tests.
 * Only valid when the original doc had no styled/non-text segments inside
 * edited regions (plain fixtures).
 */
export function docFromPlainText(text: string): docs_v1.Schema$Document {
    const lines = text.endsWith("\n")
        ? text.slice(0, -1).split("\n")
        : text.split("\n")
    return buildDoc(lines)
}
