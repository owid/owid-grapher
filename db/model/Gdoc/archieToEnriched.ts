import { load } from "archieml"
import {
    OwidGdocContent,
    TocHeadingWithTitleSupertitle,
    compact,
    RawBlockText,
    isArray,
    recursivelyMapArticleContent,
    OwidGdocStickyNavItem,
    OwidGdocType,
    checkNodeIsSpan,
    convertHeadingTextToId,
    EnrichedBlockSimpleText,
    lowercaseObjectKeys,
    OwidEnrichedGdocBlock,
    traverseEnrichedBlocks,
    ALL_CHARTS_ID,
    KEY_INSIGHTS_ID,
    ENDNOTES_ID,
    CITATION_ID,
    LICENSE_ID,
    OwidRawGdocBlock,
} from "@ourworldindata/utils"
import { parseRawBlocksToEnrichedBlocks } from "./rawToEnriched.js"
import urlSlug from "url-slug"
import { parseAuthors, spansToSimpleString } from "./gdocUtils.js"
import {
    htmlToEnrichedTextBlock,
    htmlToSimpleTextBlock,
} from "./htmlToEnriched.js"

// Topic page headings have predictable heading names which are used in the sticky nav.
// If the user hasn't explicitly defined a sticky-nav in archie to map nav items to headings,
// we can try to do it for them by looking for substring matches in the headings that they've written
function generateStickyNav(
    content: OwidGdocContent
): OwidGdocStickyNavItem[] | undefined {
    if (content.type !== OwidGdocType.TopicPage) return
    // If a sticky nav has been explicitly defined, use that.
    if (content["sticky-nav"]) return content["sticky-nav"]
    // These are the default headings that we'll try to find and create sticky nav headings for
    // Even if the id for the heading is "key-insights-on-poverty", we can just do substring matches
    const headingToIdMap = {
        ["acknowledgements"]: "Acknowledgements",
        ["country-profiles"]: "Country Profiles",
        ["explore"]: "Data Explorer",
        ["research-writing"]: "Research & Writing",
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
                for (const [substring, title] of Object.entries(
                    headingToIdMap
                )) {
                    if (headingId.includes(substring)) {
                        stickyNavItems.push({
                            text: title,
                            target: `#${headingId}`,
                        })
                    }
                }
            }
            if (node.type === "key-insights") {
                stickyNavItems.push({
                    text: headingToIdMap[KEY_INSIGHTS_ID],
                    target: `#${KEY_INSIGHTS_ID}`,
                })
            }
            if (node.type === "all-charts") {
                stickyNavItems.push({
                    text: headingToIdMap[ALL_CHARTS_ID],
                    target: `#${ALL_CHARTS_ID}`,
                })
            }
            return node
        })
    )

    stickyNavItems.push(
        ...[
            {
                text: "Cite this work",
                target: "#article-citation",
            },
            {
                text: "Reuse this work",
                target: "#article-licence",
            },
        ]
    )
    return stickyNavItems
}

function generateToc(
    body: OwidEnrichedGdocBlock[]
): TocHeadingWithTitleSupertitle[] {
    const toc: TocHeadingWithTitleSupertitle[] = []

    // track h2s and h3s for the SDG table of contents
    body.forEach((block) =>
        traverseEnrichedBlocks(block, (child) => {
            if (child.type === "heading") {
                const { level, text, supertitle } = child
                const titleString = spansToSimpleString(text)
                const supertitleString =
                    supertitle && spansToSimpleString(supertitle)
                if (titleString && (level == 2 || level == 3)) {
                    toc.push({
                        title: titleString,
                        supertitle: supertitleString,
                        text: titleString,
                        slug: urlSlug(`${supertitleString} ${titleString}`),
                        isSubheading: level == 3,
                    })
                }
            }
        })
    )

    return toc
}

function formatCitation(
    rawCitation?: string | string[]
): undefined | EnrichedBlockSimpleText[] {
    if (!rawCitation) return
    const citationArray = isArray(rawCitation) ? rawCitation : [rawCitation]
    return citationArray.map(htmlToSimpleTextBlock)
}

export const archieToEnriched = (text: string): OwidGdocContent => {
    const refs = (text.match(/{ref}(.*?){\/ref}/gims) || []).map(function (
        val: string,
        i: number
    ): { blocks: OwidRawGdocBlock[] } {
        // mutate original text
        text = text.replace(
            val,
            `<a class="ref" href="#note-${i + 1}"><sup>${i + 1}</sup></a>`
        )
        // wrap inner text in a freeform array and parse it
        return load(`[+blocks]\n${val.replace(/\{\/?ref\}/g, "")}\n[]`)
    })

    // A note on the use of Regexps here: doing this is in theory a bit crude
    // as we are hacking at the plain text representation where we will have a
    // much richer tree data structure a bit further down. However, manipulating
    // the tree data structure to correctly collect whitespace and deal with
    // arbitrary numbers of opening/closing spans correctly adds significant complexity.
    // Since here we expect to have created the a tag ourselves and always as the
    // deepest level of nesting (see the readElements function) we can be confident
    // that this will work as expected in this case and is much simpler than handling
    // this later.

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

    // Parse elements of the ArchieML into enrichedBlocks
    parsed.body = compact(parsed.body.map(parseRawBlocksToEnrichedBlocks))

    parsed.toc = generateToc(parsed.body)

    parsed.refs = refs.map(({ blocks }) =>
        blocks.map(parseRawBlocksToEnrichedBlocks)
    )

    parsed.summary = parsed.summary?.map((html: RawBlockText) =>
        htmlToEnrichedTextBlock(html.value)
    )

    parsed.citation = formatCitation(parsed.citation)

    parsed["sticky-nav"] = generateStickyNav(parsed)

    // this property was originally named byline even though it was a comma-separated list of authors
    // once this has been deployed for a while and we've migrated the property name in all gdocs,
    // we can remove this parsed.byline vestige
    parsed.authors = parseAuthors(parsed.byline || parsed.authors)

    return parsed
}
