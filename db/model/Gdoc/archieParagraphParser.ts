import { type GdocParagraph } from "@ourworldindata/types"

export const whitespacePattern =
    "\\u0000\\u0009\\u000A\\u000B\\u000C\\u000D\\u0020\\u00A0\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200A\\u200B\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"
const slugBlacklist = `${whitespacePattern}\\u005B\\u005C\\u005D\\u007B\\u007D\\u003A`

const scopeMarkerOnly = new RegExp(
    `^\\s*(\\[|\\{)[ \\t\\r]*([\\+\\.]*)[ \\t\\r]*([^${slugBlacklist}]*)[ \\t\\r]*(\\]|\\})\\s*$`
)

export interface ArchieScopeMarker {
    bracket: "[" | "{"
    flags: string
    slug: string
}

export interface ArchieParagraphMarkerToken {
    type: "marker"
    marker: ArchieScopeMarker
    paragraph: GdocParagraph
    paragraphIndex: number
    line: string
}

export interface ArchieParagraphTextToken {
    type: "paragraph"
    paragraph: GdocParagraph
    paragraphIndex: number
    lines: string[]
}

export interface ArchieParagraphHorizontalRuleToken {
    type: "horizontal-rule"
    paragraph: GdocParagraph
    paragraphIndex: number
}

export type ArchieParagraphToken =
    | ArchieParagraphMarkerToken
    | ArchieParagraphTextToken
    | ArchieParagraphHorizontalRuleToken

export function getParagraphContentLines(text: string): string[] {
    if (!text) return []
    const normalized = text.replace(/\r/g, "")
    const content = normalized.endsWith("\n")
        ? normalized.slice(0, -1)
        : normalized
    if (content.length === 0) return []
    return content.split("\n")
}

export function parseScopeMarkerLine(
    line: string
): ArchieScopeMarker | undefined {
    const match = scopeMarkerOnly.exec(line)
    if (!match) return undefined

    const bracket = match[1] as "[" | "{"
    const flags = match[2] ?? ""
    const slug = (match[3] ?? "").trim()

    if (slug.toLowerCase() === "ref") {
        return undefined
    }

    return { bracket, flags, slug }
}

export function parseScopeMarkerParagraph(
    paragraph: GdocParagraph
): ArchieScopeMarker | undefined {
    if (paragraph.type !== "paragraph") return undefined
    const lines = getParagraphContentLines(paragraph.text)
    if (lines.length !== 1) return undefined
    return parseScopeMarkerLine(lines[0])
}

export function tokenizeParagraphs(
    paragraphs: GdocParagraph[]
): ArchieParagraphToken[] {
    const tokens: ArchieParagraphToken[] = []

    paragraphs.forEach((paragraph, index) => {
        if (paragraph.type === "horizontal-rule") {
            tokens.push({
                type: "horizontal-rule",
                paragraph,
                paragraphIndex: index,
            })
            return
        }

        const lines = getParagraphContentLines(paragraph.text)
        const marker =
            lines.length === 1 ? parseScopeMarkerLine(lines[0]) : undefined

        if (marker) {
            tokens.push({
                type: "marker",
                marker,
                paragraph,
                paragraphIndex: index,
                line: lines[0],
            })
        } else {
            tokens.push({
                type: "paragraph",
                paragraph,
                paragraphIndex: index,
                lines,
            })
        }
    })

    return tokens
}
