import { load } from "archieml"
import { createHash } from "crypto"
import {
    OwidGdocPostContent,
    TocHeadingWithTitleSupertitle,
    compact,
    isArray,
    recursivelyMapArticleContent,
    OwidGdocStickyNavItem,
    OwidGdocType,
    checkNodeIsSpan,
    EnrichedBlockSimpleText,
    lowercaseObjectKeys,
    OwidEnrichedGdocBlock,
    traverseEnrichedBlock,
    ALL_CHARTS_ID,
    KEY_INSIGHTS_ID,
    ENDNOTES_ID,
    CITATION_ID,
    LICENSE_ID,
    RESEARCH_AND_WRITING_ID,
    checkIsPlainObjectWithGuard,
    identity,
    isEmpty,
} from "@ourworldindata/utils"
import { convertHeadingTextToId } from "@ourworldindata/components"
import {
    parseRawBlocksToEnrichedBlocks,
    parseRefs,
    parseText,
} from "./rawToEnriched.js"
import urlSlug from "url-slug"
import { extractUrl, parseAuthors, spansToSimpleString } from "./gdocUtils.js"
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
        [CITATION_ID]: "Cite This Work",
        [ENDNOTES_ID]: "Endnotes",
        [KEY_INSIGHTS_ID]: "Key Insights",
        [LICENSE_ID]: "Reuse This Work",
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

    if (!isEmpty(content.refs?.definitions)) {
        stickyNavItems.push({
            text: "Endnotes",
            target: `#${ENDNOTES_ID}`,
        })
    }

    stickyNavItems.push(
        ...[
            {
                text: "Cite This Work",
                target: `#${CITATION_ID}`,
            },
            {
                text: "Reuse This Work",
                target: `#${LICENSE_ID}`,
            },
        ]
    )
    return stickyNavItems
}

export function generateToc(
    body: OwidEnrichedGdocBlock[] | undefined,
    isTocForSidebar: boolean = false
): TocHeadingWithTitleSupertitle[] {
    if (!body) return []

    // For linear topic pages, we record h1s & h2s
    // For the sdg-toc, we record h2s & h3s (as it was developed before we decided to use h1s as our top level heading)
    // It would be nice to standardise this but it would require a migration, updating CSS, updating Gdocs, etc.
    const [primary, secondary] = isTocForSidebar ? [1, 2] : [2, 3]
    const toc: TocHeadingWithTitleSupertitle[] = []

    body.forEach((block) =>
        traverseEnrichedBlock(block, (child) => {
            if (child.type === "heading") {
                const { level, text, supertitle } = child
                const titleString = spansToSimpleString(text)
                const supertitleString = supertitle
                    ? spansToSimpleString(supertitle)
                    : ""
                if (titleString && (level === primary || level === secondary)) {
                    toc.push({
                        title: titleString,
                        supertitle: supertitleString,
                        text: titleString,
                        slug: urlSlug(`${supertitleString} ${titleString}`),
                        isSubheading: level === secondary,
                    })
                }
            }
            if (isTocForSidebar && child.type === "all-charts") {
                toc.push({
                    title: child.heading,
                    text: child.heading,
                    slug: ALL_CHARTS_ID,
                    isSubheading: false,
                })
            }
        })
    )

    if (isTocForSidebar) {
        toc.push(
            {
                title: "Endnotes",
                text: "Endnotes",
                slug: "article-endnotes",
                isSubheading: false,
            },
            {
                title: "Citation",
                text: "Citation",
                slug: "article-citation",
                isSubheading: false,
            },
            {
                title: "Licence",
                text: "Licence",
                slug: "article-licence",
                isSubheading: false,
            }
        )
    }

    return toc
}

export function formatCitation(
    rawCitation?: string | string[]
): undefined | EnrichedBlockSimpleText[] {
    if (!rawCitation) return
    const citationArray = isArray(rawCitation) ? rawCitation : [rawCitation]
    return citationArray.map(htmlToSimpleTextBlock)
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
        extractedText = extractedText.replace(
            rawRef,
            `<a class="ref" href="#note-${footnoteNumber}"><sup>${footnoteNumber}</sup></a>`
        )

        if (isInlineRef) {
            const isAlreadySeen = Boolean(
                rawInlineRefs.find(
                    (rawInlineRef) =>
                        checkIsPlainObjectWithGuard(rawInlineRef) &&
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
    ) => void = identity
): OwidGdocPostContent => {
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
    parsed.body = compact(parsed.body.map(parseRawBlocksToEnrichedBlocks))
    const deprecationNotice = parsed["deprecation-notice"]
    if (deprecationNotice) {
        parsed["deprecation-notice"] = compact(deprecationNotice.map(parseText))
    }

    const parsedRefs = parseRefs({
        refs: [...(parsed.refs ?? []), ...rawInlineRefs],
        refsByFirstAppearance,
    })
    parsed.refs = parsedRefs

    // this property was originally named byline even though it was a comma-separated list of authors
    // once this has been deployed for a while and we've migrated the property name in all gdocs,
    // we can remove this parsed.byline vestige
    parsed.authors = parseAuthors(parsed.byline || parsed.authors)

    additionalEnrichmentFunction(parsed)

    return parsed
}
