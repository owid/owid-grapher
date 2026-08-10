import {
    ContentGraphLinkType,
    EnrichedBlockText,
    OwidGdocMinimalPostInterface,
    Span,
} from "@ourworldindata/types"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import { getLinkedDocumentUrl } from "../../site/gdocs/utils.js"

// An article's `latest-feed-excerpt` is authored rich text and can contain
// the same internal links its body can — most importantly Google Doc links to
// other articles. On the site those are resolved at render time through
// AttachmentsContext; an email has no such context, so they are resolved here
// instead, before the template ever sees them.

/**
 * Resolve one span's link, if it has one. Google Doc links become the public
 * URL of the document they point at. Grapher and explorer links are already
 * public URLs and pass through untouched.
 *
 * Anything left unresolvable — a doc that isn't registered or isn't
 * published, or a link type with no meaning in an email (details on demand,
 * guided charts) — degrades to plain text, which is what the site does with a
 * link it can't resolve. Better a missing link than one pointing at a Google
 * Doc that subscribers can't open.
 */
function resolveSpan(
    span: Span,
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>,
    baseUrl: string
): Span {
    const resolved =
        "children" in span && span.children
            ? ({
                  ...span,
                  children: span.children.map((child) =>
                      resolveSpan(child, linkedDocuments, baseUrl)
                  ),
              } as Span)
            : span
    if (resolved.spanType !== "span-link") return resolved

    switch (getLinkType(resolved.url)) {
        case ContentGraphLinkType.Url:
        case ContentGraphLinkType.Grapher:
        case ContentGraphLinkType.Explorer:
            return resolved
        case ContentGraphLinkType.Gdoc: {
            const linkedDocument = linkedDocuments[getUrlTarget(resolved.url)]
            if (!linkedDocument?.published) break
            return {
                ...resolved,
                url: getLinkedDocumentUrl(
                    linkedDocument,
                    resolved.url,
                    baseUrl
                ),
            }
        }
        default:
            break
    }
    return { spanType: "span-fallback", children: resolved.children }
}

export function resolveExcerptLinks(
    blocks: EnrichedBlockText[],
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>,
    baseUrl: string
): EnrichedBlockText[] {
    return blocks.map((block) => ({
        ...block,
        value: block.value.map((span) =>
            resolveSpan(span, linkedDocuments, baseUrl)
        ),
    }))
}
