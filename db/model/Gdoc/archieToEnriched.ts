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
    lowercaseObjectKeys,
} from "@ourworldindata/utils"
import { parseRawBlocksToEnrichedBlocks } from "./rawToEnriched.js"
import urlSlug from "url-slug"
import { isObject } from "lodash"
import { getTitleSupertitleFromHeadingText } from "./gdocUtils.js"
import {
    htmlToEnrichedTextBlock,
    htmlToSimpleTextBlock,
} from "./htmlToEnriched.js"

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

    // Inside .body all keys will be sanitized to lowercase but
    // for the frontmatter this doesn't happen down there - do it now so
    // that "Title: bla" works as well as "title: bla"
    const parsed_unsanitized = load(noLeadingWSLinks)
    const parsed: any = lowercaseObjectKeys(parsed_unsanitized)

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
        child = lowercaseObjectKeys(child) as OwidRawGdocBlock

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
    const summary: RawBlockText[] | undefined = parsed.summary
    parsed.summary =
        summary === undefined
            ? undefined
            : summary.map((html) => htmlToEnrichedTextBlock(html.value))
    const citation: string | string[] | undefined = parsed.citation
    parsed.citation =
        citation === undefined
            ? undefined
            : typeof citation === "string"
            ? htmlToSimpleTextBlock(citation)
            : citation.map(htmlToSimpleTextBlock)
    parsed.toc = toc
    return parsed
}
