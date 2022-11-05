// Original work from https://github.com/rdmurphy/doc-to-archieml
// Forked and expanded in https://github.com/owid/doc-to-archieml

import { load } from "archieml"
import { google as googleApisInstance, GoogleApis, docs_v1 } from "googleapis"
import {
    OwidArticleBlock,
    OwidArticleContent,
    Span,
    BlockHorizontalRule,
    SpanSimpleText,
    BlockImage,
    BlockList,
    BlockHeader, 
} from "@ourworldindata/utils"
import {match, Pattern } from "ts-pattern"

export interface DocToArchieMLOptions {
    documentId: docs_v1.Params$Resource$Documents$Get["documentId"]
    auth: docs_v1.Params$Resource$Documents$Get["auth"]
    client?: docs_v1.Docs
    google?: GoogleApis
    imageHandler?: (elementId: string, doc: docs_v1.Schema$Document) => Promise<BlockImage>
}

interface ElementMemo {
    isInList: boolean
    body: OwidArticleBlock[]
}

const serializeOwidArticleBlockToArchieMLString = (block: OwidArticleBlock) : string => { 

    const content = match(block).with({type: Pattern.union("position", "url", "html", "text")}, b => b.value).otherwise(() => "")
    return `
{.${block.type}}
{}
    `
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

    let text = await readElements(data, imageHandler)

    const refs = (text.match(/{ref}(.*?){\/ref}/gims) || []).map(function (
        val: string,
        i: number
    ) {
        text = text.replace(val, `<ref id="${i}" />`)
        return val.replace(/\{\/?ref\}/g, "")
    })

    const parsed = load(text)

    parsed.refs = refs

    // Parse lists and include lowercase vals
    parsed.body = parsed.body.reduce(
        (memo: ElementMemo, d: OwidArticleBlock) => {
            Object.keys(d).forEach((k) => {
                ;(d as any)[k.toLowerCase()] = (d as any)[k]
            })

            if (d.type === "text" && d.value.startsWith("* ")) {
                if (memo.isInList) {
                    (memo.body[memo.body.length - 1] as BlockList).value.push(
                        // TODO: this assumes that lists only contain simple text
                        d.value.replace("* ", "").trim()
                    )
                } else {
                    memo.isInList = true
                    memo.body.push({
                        type: "list",
                        value: [d.value.replace("* ", "").trim()],
                    })
                }
            } else {
                if (memo.isInList) {
                    memo.isInList = false
                }
                memo.body.push(d)
            }
            return memo
        },
        {
            isInList: false,
            body: [],
        }
    ).body

    // pass text to ArchieML and return results
    return parsed
}

async function readElements(
    document: docs_v1.Schema$Document,
    imageHandler: ((elementId: string, doc: docs_v1.Schema$Document) => Promise<BlockImage>) | undefined
): Promise<string> {
    // prepare the text holder
    let text = ""

    // check if the body key and content key exists, and give up if not
    if (!document.body) return text
    if (!document.body.content) return text

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
                        const header : BlockHeader = { type: "header", value: { text: {text.trim()}, level: Number.parseInt(headingLevel)}}
                        return `
{.header}
text: ${text.trim()}
level: ${Number.parseInt(headingLevel)}
{}`
                    }
                    return text
                }
                let elementText = ""
                for (const value of values) {
                    // we only need to add a bullet to the first value, so we check
                    const isFirstValue = idx === 0

                    // prepend an asterisk if this is a list item
                    const prefix = needsBullet && isFirstValue ? "* " : ""

                    // concat the text
                    const _text = await readParagraphElement(
                        value,
                        document,
                        imageHandler
                    )
                    elementText += `${prefix}${_text}`
                    idx++
                }
                text += taggedText(elementText)
            }
        }
    }

    return text
}

async function readParagraphElement(
    element: docs_v1.Schema$ParagraphElement,
    data: docs_v1.Schema$Document,
    imageHandler?:  ((elementId: string, doc: docs_v1.Schema$Document) => Promise<BlockImage>) | undefined
): Promise<Span | BlockHorizontalRule | BlockImage | null> {
    // pull out the text

    const textRun = element.textRun

    // sometimes it's not there, skip this all if so
    if (textRun) {
        // sometimes the content isn't there, and if so, make it an empty string
        // console.log(element);

        const content = textRun.content || ""

        let span: Span = { type: "span-simple-text", text: content }

        // step through optional text styles to check for an associated URL
        if (!textRun.textStyle) return span

        if (textRun.textStyle.link?.url)
            span = {
                type: "span-link",
                url: textRun.textStyle.link!.url!,
                children: [span],
            }

        // console.log(textRun);
        if (textRun.textStyle.italic) {
            span = { type: "span-italic", children: [span] }
        }
        if (textRun.textStyle.bold) {
            span = { type: "span-bold", children: [span] }
        }

        return span
    } else if (element.inlineObjectElement && imageHandler) {
        const objectId = element.inlineObjectElement.inlineObjectId
        if (objectId)
            return await imageHandler(objectId, data)
        else   
            return null
    } else if (element.horizontalRule) {
        return { type: "horizontal-rule" }
    } else {
        return null
    }
}
