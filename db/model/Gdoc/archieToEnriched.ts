import * as _ from "lodash-es"
import * as R from "remeda"
import { load } from "archieml"
import { createHash } from "crypto"
import {
    OwidGdocPostContent,
    recursivelyMapArticleContent,
    OwidGdocStickyNavItem,
    OwidGdocType,
    checkNodeIsSpan,
    EnrichedBlockSimpleText,
    lowercaseObjectKeys,
    traverseEnrichedBlock,
    ALL_CHARTS_ID,
    KEY_INSIGHTS_ID,
    RESEARCH_AND_WRITING_ID,
} from "@ourworldindata/utils"
import type {
    OwidEnrichedGdocBlock,
    RefDictionary,
    Span,
} from "@ourworldindata/types"
import { convertHeadingTextToId } from "@ourworldindata/components"
import {
    parseRawBlocksToEnrichedBlocks,
    parseRefs,
    parseText,
} from "./rawToEnriched.js"
import { extractUrl, parseAuthors } from "./gdocUtils.js"
import { htmlToSimpleTextBlock } from "./htmlToEnriched.js"
import { RESEARCH_AND_WRITING_DEFAULT_HEADING } from "@ourworldindata/types"

// Topic page headings have predictable heading names which are used in the sticky nav.
// If the user hasn't explicitly defined a sticky-nav in archie to map nav items to headings,
// we can try to do it for them by looking for substring matches in the headings that they've written
export function generateStickyNav(
    content: OwidGdocPostContent
): OwidGdocStickyNavItem[] | undefined {
    if (content.type !== OwidGdocType.TopicPage) return
    // If a sticky nav has been explicitly defined, use that.
    // We are using this for linear topic pages, as a way to have a document using the topic page template
    // but without a sticky nav
    if (content["sticky-nav"]) return content["sticky-nav"]

    // RegEx strings to match heading IDs with their corresponding sticky nav item text
    // e.g. if we find a heading with an ID of "explore-our-data-on-poverty", we want to add a sticky nav item with the text "Data Explorer"
    const headingsByIdRegEx = {
        ["^acknowledgements"]: "Acknowledgements",
        ["^country-profiles"]: "Country Profiles",
        // Assumes explorer headings are of the form "Explore data on [topic]" or "Explore our data on [topic]"
        ["^explore(-our)?-data"]: "Data Explorer",
        [RESEARCH_AND_WRITING_ID]: RESEARCH_AND_WRITING_DEFAULT_HEADING,
        [ALL_CHARTS_ID]: "Charts",
        [KEY_INSIGHTS_ID]: "Key Insights",
    }
    const stickyNavItems: OwidGdocStickyNavItem[] = [
        {
            // The introduction block should always exist for topic pages
            text: "Introduction",
            target: "#introduction",
        },
    ]

    content.body?.map((node) =>
        recursivelyMapArticleContent(node, (node) => {
            if (checkNodeIsSpan(node)) return node
            if (node.type === "heading") {
                const headingId = convertHeadingTextToId(node.text)
                for (const [regex, title] of Object.entries(
                    headingsByIdRegEx
                )) {
                    if (new RegExp(regex).test(headingId)) {
                        stickyNavItems.push({
                            text: title,
                            target: `#${headingId}`,
                        })
                    }
                }
            }
            if (node.type === "key-insights") {
                stickyNavItems.push({
                    text: headingsByIdRegEx[KEY_INSIGHTS_ID],
                    target: `#${KEY_INSIGHTS_ID}`,
                })
            }
            if (node.type === "all-charts") {
                stickyNavItems.push({
                    text: headingsByIdRegEx[ALL_CHARTS_ID],
                    target: `#${ALL_CHARTS_ID}`,
                })
            }
            if (node.type === "research-and-writing") {
                stickyNavItems.push({
                    text: headingsByIdRegEx[RESEARCH_AND_WRITING_ID],
                    target: `#${RESEARCH_AND_WRITING_ID}`,
                })
            }
            return node
        })
    )

    return stickyNavItems
}

export function formatCitation(
    rawCitation?: string | string[]
): undefined | EnrichedBlockSimpleText[] {
    if (!rawCitation) return
    const citationArray = _.isArray(rawCitation) ? rawCitation : [rawCitation]
    return citationArray.map(htmlToSimpleTextBlock)
}

// Empty out the parts of an ArchieML document that the parser itself discards,
// so that ref extraction (which scans the text before `load()` runs) doesn't see
// refs the parser will throw away. Without this, a {ref} after :ignore or inside
// a :skip block would still be picked up by extractRefs, polluting
// refsByFirstAppearance, shifting footnote numbers, and rendering inline refs
// that don't exist in the live document.
//
// IMPORTANT: the result is fed to `load()` as well as `extractRefs()`, and
// ArchieML's own parsing depends on seeing the :skip/:endskip directive lines.
// At :skip the parser flushes (discards) any buffered multi-line value; at :end
// it commits it. So we must keep the directive lines exactly where they are and
// only blank the content between them. If we instead deleted the directives and
// spliced the surrounding lines together, a value like:
// `dek: a\nb\n:skip\n…\n:endskip`
// would wrongly append b to dek's value, yielding "a\nb" instead of "a"
export function stripIgnoredArchieml(text: string): string {
    // :ignore wins even inside a skip block, so handle it first. Everything from
    // the :ignore line onward is discarded; there's nothing after it to splice
    // back together, so dropping the line itself is safe (the buffered value is
    // flushed identically whether the parser hits :ignore or the end of input).
    const ignore = text.match(/^[ \t\r]*:[ \t\r]*ignore\b.*$/im)
    if (ignore?.index !== undefined) text = text.slice(0, ignore.index)

    // Empty :skip … :endskip blocks while preserving both directive lines (see
    // note above). An unterminated :skip runs to the end of the document;
    // `$(?![\s\S])` anchors that fallback to EOF, since `$` alone matches
    // end-of-line under the `m` flag.
    return text.replace(
        /(^[ \t\r]*:[ \t\r]*skip\b.*$)[\s\S]*?(^[ \t\r]*:[ \t\r]*endskip\b.*$|$(?![\s\S]))/gim,
        "$1\n$2"
    )
}

// Minimal HTML attribute escaping for ref IDs that get embedded in the
// data-ref-id attribute of the post-extraction <a> tag.
function escapeRefAttr(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
}

// Post-pass after the body has been enriched and refs parsed. Walks every
// SpanRef and fills in `sourceForm.content` for inline refs by looking up
// the canonical content in the RefDictionary via the url's #note-N suffix.
// Idempotent: skips any SpanRef whose content is already non-empty or
// whose kind is "id".
function fillInlineRefSourceContent(
    body: OwidEnrichedGdocBlock[] | undefined,
    definitions: RefDictionary
): void {
    if (!body || body.length === 0) return
    const byIndex = new Map<number, Span[]>()
    for (const ref of Object.values(definitions)) {
        const spans: Span[] = []
        for (const block of ref.content) {
            if (block.type === "text") spans.push(...block.value)
        }
        byIndex.set(ref.index, spans)
    }
    const fillSpan = (span: Span): void => {
        if (span.spanType !== "span-ref") return
        if (span.sourceForm.kind !== "inline") return
        if (span.sourceForm.content.length > 0) return
        const m = span.url?.match(/^#note-(\d+)$/)
        if (!m) return
        const spans = byIndex.get(parseInt(m[1], 10) - 1)
        if (!spans) return
        span.sourceForm = { kind: "inline", content: spans }
    }
    const noop = (_b: OwidEnrichedGdocBlock): void => undefined
    for (const block of body) {
        traverseEnrichedBlock(block, noop, fillSpan)
    }
}

// Match all curly bracket {ref}some_id{/ref} and {ref}I am an inline ref{/ref} syntax in the text
// Iterate through them
// If it's an inline ref, hash its contents to use as an ID and parse it
// Record the index of the FIRST reference to each ID so that IDs can be referenced multiple times but use the same footnote number
// Replace the curly bracket syntax with <a> tags which htmlToSpans will convert later
export function extractRefs(text: string): {
    extractedText: string
    refsByFirstAppearance: Set<string>
    rawInlineRefs: unknown[]
} {
    let extractedText = text
    const RefRegExp = "{ref}(.*?){/ref}"

    const refsByFirstAppearance = new Set<string>()
    const rawInlineRefs: unknown[] = []
    const rawRefStrings = text.match(new RegExp(RefRegExp, "gims")) || []

    for (const rawRef of rawRefStrings) {
        const isInlineRef = rawRef.includes(" ")

        // This will always exist as it's the same as the RegExp from above
        // minus the g flag (so that we can extract groups)
        const match = rawRef.match(
            new RegExp(RefRegExp, "ims")
        ) as RegExpMatchArray
        const contentOrId = match[1]

        const id = isInlineRef
            ? createHash("sha1").update(contentOrId).digest("hex")
            : contentOrId

        refsByFirstAppearance.add(id)
        const index = [...refsByFirstAppearance].indexOf(id)
        const footnoteNumber = index + 1

        // A note on the use of Regexps here: doing this is in theory a bit crude
        // as we are hacking at the plain text representation where we will have a
        // much richer tree data structure a bit further down. However, manipulating
        // the tree data structure to correctly collect whitespace and deal with
        // arbitrary numbers of opening/closing spans correctly adds significant complexity.
        // Since here we expect to have created the a tag ourselves and always as the
        // deepest level of nesting (see the readElements function) we can be confident
        // that this will work as expected in this case and is much simpler than handling
        // this later.
        //
        // data-ref-kind (and data-ref-id for ID-based) preserve the ID-vs-inline
        // distinction through htmlToEnriched into SpanRef.sourceForm. Inline
        // content survives via the RefDictionary (looked up by url=#note-N) in
        // a post-pass below.
        const dataAttrs = isInlineRef
            ? `data-ref-kind="inline"`
            : `data-ref-kind="id" data-ref-id="${escapeRefAttr(contentOrId)}"`
        extractedText = extractedText.replace(
            rawRef,
            `<a class="ref" href="#note-${footnoteNumber}" ${dataAttrs}><sup>${footnoteNumber}</sup></a>`
        )

        if (isInlineRef) {
            const isAlreadySeen = Boolean(
                rawInlineRefs.find(
                    (rawInlineRef) =>
                        R.isPlainObject(rawInlineRef) &&
                        "id" in rawInlineRef &&
                        typeof rawInlineRef.id === "string" &&
                        rawInlineRef.id === id
                )
            )
            if (!isAlreadySeen) {
                const rawInlineRef = load(`
                id: ${id}
                [.+content]
                ${contentOrId}
                []
            `)
                rawInlineRefs.push(rawInlineRef)
            }
        }
    }

    return { extractedText, refsByFirstAppearance, rawInlineRefs }
}

export const archieToEnriched = (
    text: string,
    additionalEnrichmentFunction: (
        content: Record<string, unknown>
    ) => void = _.identity
): OwidGdocPostContent => {
    // Blank out content ArchieML discards (:skip blocks, anything after :ignore)
    // before extracting refs, so phantom refs from those regions aren't picked
    // up. The directive lines are preserved, so feeding this to load() below
    // produces exactly the same parse as the original text.
    text = stripIgnoredArchieml(text)

    const { extractedText, refsByFirstAppearance, rawInlineRefs } =
        extractRefs(text)
    text = extractedText

    // Replace whitespace-only inside links. We need to keep the WS around, they
    // just should not be displayed as links
    const noWSOnlyLinks = text.replace(/(<a[^>]*>)(\s+)(<\/a>)/gims, "$2")
    // Replace leading whitespace inside links. We need to keep the WS around, they
    // just should not be displayed as links
    const noLeadingWSLinks = noWSOnlyLinks.replace(
        /(<a[^>]*>)(\s+)(.*?)(<\/a>)/gims,
        "$2$1$3$4"
    )

    // Inside .body all keys will be sanitized to lowercase but
    // for the frontmatter this doesn't happen down there - do it now so
    // that "Title: bla" works as well as "title: bla"
    const parsed_unsanitized = load(noLeadingWSLinks)
    const parsed: any = lowercaseObjectKeys(parsed_unsanitized)

    // Convert "true" and "false" strings in the front matter to booleans
    for (const key of Object.keys(parsed)) {
        if (parsed[key] === "true") parsed[key] = true
        if (parsed[key] === "false") parsed[key] = false
    }

    // Convert URL front-matter properties to URLs
    for (const key of Object.keys(parsed)) {
        const value = parsed[key]
        if (typeof value === "string") {
            // this is safe to call on everything because it falls back to `value` if it's not an <a> tag
            parsed[key] = extractUrl(value)
        }
    }

    // Parse elements of the ArchieML into enrichedBlocks
    parsed.body = _.compact(parsed.body.map(parseRawBlocksToEnrichedBlocks))
    const deprecationNotice = parsed["deprecation-notice"]
    if (deprecationNotice) {
        parsed["deprecation-notice"] = _.compact(
            deprecationNotice.map(parseText)
        )
    }

    const parsedRefs = parseRefs({
        refs: [...(parsed.refs ?? []), ...rawInlineRefs],
        refsByFirstAppearance,
    })
    parsed.refs = parsedRefs

    // Fill in SpanRef.sourceForm.content for inline refs from the just-built
    // RefDictionary. extractRefs / htmlToEnriched flag inline refs with
    // `kind: "inline"` and an empty content array — the canonical content
    // lives in the dictionary, keyed by #note-N url → index.
    fillInlineRefSourceContent(parsed.body, parsedRefs.definitions)

    // this property was originally named byline even though it was a comma-separated list of authors
    // once this has been deployed for a while and we've migrated the property name in all gdocs,
    // we can remove this parsed.byline vestige
    const { authors, authorRoles } = parseAuthors(
        parsed.byline || parsed.authors
    )
    parsed.authors = authors
    parsed.authorRoles = authorRoles

    additionalEnrichmentFunction(parsed)

    return parsed
}
