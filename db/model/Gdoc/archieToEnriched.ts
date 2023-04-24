import { load } from "archieml"
import {
    OwidRawGdocBlock,
    OwidGdocContent,
    TocHeadingWithTitleSupertitle,
    compact,
    unset,
    set,
    RawBlockText,
    isArray,
    get,
    RawBlockList,
    recursivelyMapArticleContent,
    OwidGdocStickyNavItem,
    OwidGdocType,
    checkNodeIsSpan,
    convertHeadingTextToId,
    EnrichedBlockSimpleText,
} from "@ourworldindata/utils"
import { parseRawBlocksToEnrichedBlocks } from "./rawToEnriched.js"
import urlSlug from "url-slug"
import { isObject } from "lodash"
import { getTitleSupertitleFromHeadingText } from "./gdocUtils.js"
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
        ["key-insights"]: "Key Insights",
        ["explore"]: "Data Explorer",
        ["research-writing"]: "Research & Writing",
        ["endnotes"]: "Endnotes",
        ["citation"]: "Cite This Work",
        ["license"]: "Reuse This Work",
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
    ) {
        // mutate original text
        text = text.replace(
            val,
            `<a class="ref" href="#note-${i + 1}"><sup>${i + 1}</sup></a>`
        )
        // return inner text
        return val.replace(/\{\/?ref\}/g, "")
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

    const parsed = load(noLeadingWSLinks)
    const toc: TocHeadingWithTitleSupertitle[] = []
    let pointer: Array<string | number> = []
    // archie doesn't have a nested list structure. it treats as a series of text blocks
    // we want to put them into a nested (for now only <ul>) structure
    // we create a copy of where the list began so that we can push its siblings into it
    let listPointer: Array<string | number> = []
    let isInList = false

    // Traverse the tree, tracking a pointer and nesting when appropriate
    function traverseBlocks(
        value: OwidRawGdocBlock,
        callback: (child: OwidRawGdocBlock) => void
    ): void {
        // top-level
        if (isArray(value)) {
            value.forEach((value, index) => {
                pointer[0] = index
                traverseBlocks(value, callback)
            })
        } else if (value.type === "gray-section") {
            const pointerLength = pointer.length
            value.value.forEach((value, index) => {
                pointer[pointerLength] = index
                traverseBlocks(value, callback)
            })
            pointer = pointer.slice(0, -1)
        } else if (
            value.type === "sticky-left" ||
            value.type === "sticky-right" ||
            value.type === "side-by-side"
        ) {
            if (value.value?.left && isArray(value.value.left)) {
                pointer = pointer.concat(["value", "left"])
                const pointerLength = pointer.length
                value.value.left.forEach((value, index) => {
                    pointer[pointerLength] = index
                    traverseBlocks(value, callback)
                })
                pointer = pointer.slice(0, -3)
            }
            if (value.value?.right && isArray(value.value.right)) {
                pointer = pointer.concat(["value", "right"])
                const pointerLength = pointer.length
                value.value.right.forEach((value, index) => {
                    pointer[pointerLength] = index
                    traverseBlocks(value, callback)
                })
                pointer = pointer.slice(0, -3)
            }
        } else {
            callback(value)
        }
    }

    // Traverse the tree:
    // mutate it to nest lists correctly
    // track h2s and h3s for the SDG table of contents
    traverseBlocks(parsed.body, (child: OwidRawGdocBlock) => {
        // ensure keys are lowercase
        child = Object.entries(child).reduce(
            (acc, [key, value]) => ({ ...acc, [key.toLowerCase()]: value }),
            {} as OwidRawGdocBlock
        )

        // nest list items
        if (child.type === "text" && child.value.startsWith("* ")) {
            if (!isInList) {
                // initiate the <ul> list
                isInList = true
                listPointer = [...pointer]
                set(parsed.body, listPointer, {
                    type: "list",
                    value: [child.value.replace("* ", "").trim()],
                })
            } else {
                const list: RawBlockList = get(parsed.body, listPointer)
                if (isArray(list.value)) {
                    // push a copy of the item into the <ul> parent
                    list.value.push(child.value.replace("* ", "").trim())
                    // delete the original value
                    unset(parsed.body, pointer)
                }
            }
        } else {
            isInList = false
        }

        // populate toc with h2's and h3's
        if (child.type === "heading" && isObject(child.value)) {
            const {
                value: { level, text = "" },
            } = child
            const [title, supertitle] = getTitleSupertitleFromHeadingText(text)
            if (text && (level == "2" || level == "3")) {
                const slug = urlSlug(text)
                toc.push({
                    title,
                    supertitle,
                    text,
                    slug,
                    isSubheading: level == "3",
                })
            }
        }
    })

    // Parse elements of the ArchieML into enrichedBlocks
    parsed.body = compact(parsed.body.map(parseRawBlocksToEnrichedBlocks))

    parsed.refs = refs.map(htmlToEnrichedTextBlock)

    parsed.summary = parsed.summary?.map((html: RawBlockText) =>
        htmlToEnrichedTextBlock(html.value)
    )

    parsed.citation = formatCitation(parsed.citation)

    parsed.toc = toc

    parsed["sticky-nav"] = generateStickyNav(parsed)

    // this property was originally named byline even though it was a comma-separated list of authors
    // once this has been deployed for a while and we've migrated the property name in all gdocs,
    // we can remove this parsed.byline vestige
    parsed.authors = (parsed.byline || parsed.authors || "Our World In Data")
        .split(",")
        .map((author: string) => author.trim())

    return parsed
}
