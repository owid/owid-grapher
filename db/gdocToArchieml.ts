// Original work from https://github.com/rdmurphy/doc-to-archieml
// Forked and expanded in https://github.com/owid/doc-to-archieml

import { load } from "archieml"
import { google as googleApisInstance, GoogleApis, docs_v1 } from "googleapis"
import {
    OwidRawArticleBlock,
    Span,
    RawBlockHorizontalRule,
    RawBlockImage,
    RawBlockHeading,
    OwidArticleContent,
    TocHeadingWithTitleSupertitle,
    compact,
    unset,
    set,
    RawBlockText,
    isArray,
    get,
    RawBlockList,
} from "@ourworldindata/utils"
import {
    htmlToEnrichedTextBlock,
    htmlToSimpleTextBlock,
    owidRawArticleBlockToArchieMLString,
    spanToHtmlString,
} from "./gdocUtils"
import { match, P } from "ts-pattern"
import { parseRawBlocksToEnrichedBlocks } from "./gdocBlockParsersRawToEnriched.js"
import urlSlug from "url-slug"
import { isObject } from "lodash"
export interface DocToArchieMLOptions {
    documentId: docs_v1.Params$Resource$Documents$Get["documentId"]
    auth: docs_v1.Params$Resource$Documents$Get["auth"]
    client?: docs_v1.Docs
    google?: GoogleApis
    imageHandler?: (
        elementId: string,
        doc: docs_v1.Schema$Document
    ) => Promise<RawBlockImage>
}

export const stringToArchieML = (text: string): OwidArticleContent => {
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
        value: OwidRawArticleBlock,
        callback: (child: OwidRawArticleBlock) => void
    ): void {
        // top-level
        if (isArray(value)) {
            value.forEach((value, index) => {
                pointer[0] = index
                traverseBlocks(value, callback)
            })
        } else if (value.type === "grey-section") {
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
    traverseBlocks(parsed.body, (child: OwidRawArticleBlock) => {
        // ensure keys are lowercase
        child = Object.entries(child).reduce(
            (acc, [key, value]) => ({ ...acc, [key.toLowerCase()]: value }),
            {} as OwidRawArticleBlock
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

export const gdocToArchieML = async ({
    auth,
    client,
    documentId,
    google = googleApisInstance,
    imageHandler,
}: DocToArchieMLOptions): Promise<OwidArticleContent> => {
    // create docs client if not provided
    if (!client) {
        client = google.docs({
            version: "v1",
            auth,
        })
    }

    // pull the data out of the doc
    const { data } = await client.documents.get({
        documentId,
    })

    // convert the doc's content to text ArchieML will understand
    const { text } = await readElements(data, imageHandler)

    // pass text to ArchieML and return results
    return stringToArchieML(text)
}

async function readElements(
    document: docs_v1.Schema$Document,
    imageHandler:
        | ((
              elementId: string,
              doc: docs_v1.Schema$Document
          ) => Promise<RawBlockImage>)
        | undefined
): Promise<{ text: string }> {
    // prepare the text holder
    let text = ""

    // check if the body key and content key exists, and give up if not
    if (!document.body) return { text }
    if (!document.body.content) return { text }

    // loop through each content element in the body

    for (const element of document.body.content) {
        if (element.paragraph) {
            // get the paragraph within the element
            const paragraph: docs_v1.Schema$Paragraph = element.paragraph

            // this is a list
            const needsBullet = paragraph.bullet != null

            if (paragraph.elements) {
                // all values in the element
                const values: docs_v1.Schema$ParagraphElement[] =
                    paragraph.elements

                let idx = 0

                const taggedText = function (text: string): string {
                    if (
                        paragraph.paragraphStyle?.namedStyleType?.includes(
                            "HEADING"
                        )
                    ) {
                        const headingLevel =
                            paragraph.paragraphStyle.namedStyleType.replace(
                                "HEADING_",
                                ""
                            )

                        const heading: RawBlockHeading = {
                            type: "heading",
                            value: {
                                text: text.trim(),
                                level: headingLevel,
                            },
                        }
                        return owidRawArticleBlockToArchieMLString(heading)
                    }
                    return text
                }
                let elementText = ""
                for (const value of values) {
                    // we only need to add a bullet to the first value, so we check
                    const isFirstValue = idx === 0

                    // prepend an asterisk if this is a list item
                    // TODO: I think the ArchieML spec says that every element needs the *
                    const prefix = needsBullet && isFirstValue ? "* " : ""

                    // concat the text
                    const parsedElement = await readParagraphElement(
                        value,
                        document,
                        imageHandler
                    )
                    const fragmentText = match(parsedElement)
                        .with(
                            { type: P.union("image", "horizontal-rule") },
                            owidRawArticleBlockToArchieMLString
                        )
                        .with({ spanType: P.any }, (s) => spanToHtmlString(s))
                        .with(P.nullish, () => "")
                        .exhaustive()
                    elementText += `${prefix}${fragmentText}`
                    idx++
                }
                text += taggedText(elementText)
            }
        }
    }

    return { text }
}

async function readParagraphElement(
    element: docs_v1.Schema$ParagraphElement,
    data: docs_v1.Schema$Document,
    imageHandler?:
        | ((
              elementId: string,
              doc: docs_v1.Schema$Document
          ) => Promise<RawBlockImage>)
        | undefined
): Promise<Span | RawBlockHorizontalRule | RawBlockImage | null> {
    // pull out the text

    const textRun = element.textRun

    // sometimes it's not there, skip this all if so
    if (textRun) {
        // sometimes the content isn't there, and if so, make it an empty string
        // console.log(element);

        const content = textRun.content || ""

        let span: Span = { spanType: "span-simple-text", text: content }

        // step through optional text styles to check for an associated URL
        if (!textRun.textStyle) return span

        if (textRun.textStyle.link?.url)
            span = {
                spanType: "span-link",
                url: textRun.textStyle.link!.url!,
                children: [span],
            }

        // console.log(textRun);
        if (textRun.textStyle.italic) {
            span = { spanType: "span-italic", children: [span] }
        }
        if (textRun.textStyle.bold) {
            span = { spanType: "span-bold", children: [span] }
        }
        if (textRun.textStyle.baselineOffset === "SUPERSCRIPT") {
            span = { spanType: "span-superscript", children: [span] }
        }
        if (textRun.textStyle.baselineOffset === "SUBSCRIPT") {
            span = { spanType: "span-subscript", children: [span] }
        }

        return span
    } else if (element.inlineObjectElement && imageHandler) {
        const objectId = element.inlineObjectElement.inlineObjectId
        if (objectId) return await imageHandler(objectId, data)
        else return null
    } else if (element.horizontalRule) {
        return { type: "horizontal-rule" }
    } else {
        return null
    }
}

export const getTitleSupertitleFromHeadingText = (
    headingText: string
): [string, string | undefined] => {
    const VERTICAL_TAB_CHAR = "\u000b"
    const [beforeSeparator, afterSeparator] =
        headingText.split(VERTICAL_TAB_CHAR)

    return [
        afterSeparator || beforeSeparator,
        afterSeparator ? beforeSeparator : undefined,
    ]
}
