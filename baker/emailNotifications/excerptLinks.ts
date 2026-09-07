import {
    ContentGraphLinkType,
    EnrichedBlockText,
    OwidEnrichedGdocBlock,
    OwidGdocMinimalPostInterface,
    Span,
} from "@ourworldindata/types"
import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import { match, P } from "ts-pattern"
import { getLinkedDocumentUrl } from "../../site/gdocs/utils.js"

// Posts can contain Google Doc links to other documents.
// On the site those are resolved at render time through AttachmentsContext;
// an email has no such context, so they are resolved here instead,
// before the template ever sees them.

/**
 * Resolve one span's link, if it has one. Google Doc links become the public
 * URL of the document they point at. Grapher and explorer links are already
 * public URLs and pass through untouched.
 *
 * Anything left unresolvable — a doc that isn't registered or isn't
 * published, or a link type with no meaning in an email (details on demand,
 * guided charts) — degrades to plain text.
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

    const url = resolveLinkUrl(resolved.url, linkedDocuments, baseUrl)
    if (!url) return { spanType: "span-fallback", children: resolved.children }
    return { ...resolved, url }
}

/**
 * Resolve an authored link URL to one subscribers can open, or undefined if
 * it can't be resolved (see `resolveSpan`).
 */
export function resolveLinkUrl(
    url: string,
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>,
    baseUrl: string
): string | undefined {
    return match(getLinkType(url))
        .with(
            P.union(
                ContentGraphLinkType.Url,
                ContentGraphLinkType.Grapher,
                ContentGraphLinkType.Explorer
            ),
            () => url
        )
        .with(ContentGraphLinkType.Gdoc, () => {
            const linkedDocument = linkedDocuments[getUrlTarget(url)]
            if (!linkedDocument?.published) return undefined
            return getLinkedDocumentUrl(linkedDocument, url, baseUrl)
        })
        .otherwise(() => undefined)
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

/**
 * Resolve the links in the block types the email renders (text, heading,
 * list and cta). Other blocks pass through untouched; the template skips them. A cta
 * block whose link can't be resolved is dropped rather than rendered as a
 * dead end.
 */
export function resolveBodyLinks(
    blocks: OwidEnrichedGdocBlock[],
    linkedDocuments: Record<string, OwidGdocMinimalPostInterface>,
    baseUrl: string
): OwidEnrichedGdocBlock[] {
    const resolveSpans = (spans: Span[]): Span[] =>
        spans.map((span) => resolveSpan(span, linkedDocuments, baseUrl))
    return blocks.flatMap((block): OwidEnrichedGdocBlock[] =>
        match(block)
            .with({ type: "text" }, (block) => [
                { ...block, value: resolveSpans(block.value) },
            ])
            .with({ type: "heading" }, (block) => [
                { ...block, text: resolveSpans(block.text) },
            ])
            .with({ type: P.union("list", "numbered-list") }, (block) => [
                {
                    ...block,
                    items: block.items.map((item) => ({
                        ...item,
                        value: resolveSpans(item.value),
                    })),
                },
            ])
            .with({ type: "cta" }, (block) => {
                const url = resolveLinkUrl(block.url, linkedDocuments, baseUrl)
                return url ? [{ ...block, url }] : []
            })
            .otherwise((block) => [block])
    )
}
