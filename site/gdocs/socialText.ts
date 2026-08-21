import {
    OwidEnrichedGdocBlock,
    OwidGdocMinimalPostInterface,
    Span,
} from "@ourworldindata/utils"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import { ContentGraphLinkType } from "@ourworldindata/types"
import { getLinkedDocumentUrl } from "./utils.js"

function spansToPlainText(spans: Span[]): string {
    return spans
        .map((span): string => {
            if (span.spanType === "span-simple-text") return span.text
            if (span.spanType === "span-newline") return "\n"
            return spansToPlainText(span.children)
        })
        .join("")
}

function resolveCtaUrl(
    rawUrl: string,
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
): string {
    if (getLinkType(rawUrl) !== ContentGraphLinkType.Gdoc) return rawUrl
    const target = getUrlTarget(rawUrl)
    const doc = linkedDocuments[target]
    if (!doc) return rawUrl
    return getLinkedDocumentUrl(doc, rawUrl)
}

function ensureTrailingPunctuation(text: string): string {
    const trimmed = text.trimEnd()
    return /[.!?…]["'”’)\]]*$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/** Plain text for the admin-only "Copy for social" button, shared by data
 * insights and announcements. The authors note is passed in because its
 * wording differs per gdoc type. */
export function buildSocialText({
    title,
    body,
    authorsNote,
    linkedDocuments,
}: {
    title: string
    body: OwidEnrichedGdocBlock[]
    authorsNote?: string
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>
}): string {
    const paragraphs: string[] = []
    let ctaText: string | undefined
    let ctaUrl: string | undefined

    for (const block of body) {
        if (block.type === "text") {
            paragraphs.push(spansToPlainText(block.value))
        } else if (block.type === "cta") {
            ctaText = block.text.replace(/[.:]+$/, "")
            ctaUrl = resolveCtaUrl(block.url, linkedDocuments)
        }
    }

    const parts = [ensureTrailingPunctuation(title), paragraphs.join("\n\n")]

    if (authorsNote) {
        parts.push(authorsNote)
    }

    if (ctaText && ctaUrl) {
        parts.push(`${ctaText}: ${ctaUrl}`)
    }

    return parts.filter(Boolean).join("\n\n")
}
