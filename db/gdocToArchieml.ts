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
    BlockStructuredText,
    BlockChartValue,
    BlockRecirc,
    BlockRecircValue,
    ChartStoryValue,
    OwidArticleEnrichedBlock,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"

export interface DocToArchieMLOptions {
    documentId: docs_v1.Params$Resource$Documents$Get["documentId"]
    auth: docs_v1.Params$Resource$Documents$Get["auth"]
    client?: docs_v1.Docs
    google?: GoogleApis
    imageHandler?: (
        elementId: string,
        doc: docs_v1.Schema$Document
    ) => Promise<BlockImage>
}

interface ElementMemo {
    isInList: boolean
    body: OwidArticleBlock[]
}

function appendDotEndIfMultiline(line: string): string {
    if (line.includes("\n")) return line + "\n.end"
    return line
}

function serializeKeyValue(key: string, val: string): string {
    return `${key}: ${appendDotEndIfMultiline(val)}`
}

function* serializeStringProperties(properties: [string, string][]) {
    for (const [k, v] of properties) {
        yield serializeKeyValue(k, v)
    }
}

function serializeObjectBlock<T>(
    type: string,
    block: T,
    contentSerializer: (block: T) => string
): string {
    return `
{.${type}}
${contentSerializer(block)}
{}
`
}

function serializeStringOnlyObject(obj: {
    type: string
    value: Record<string, string>
}): string {
    const serializeFn = (b: Record<string, string>) =>
        [...serializeStringProperties(Object.entries(b))].join("\n")
    return serializeObjectBlock(obj.type, obj.value, serializeFn)
}

function serializeSingleStringObject(obj: {
    type: string
    value: string
}): string {
    return serializeKeyValue(obj.type, obj.value)
}

function serializeBlockList<T>(
    blockname: string,
    blocks: T[],
    contentSerializer: (block: T) => string,
    isFreeformArray: boolean
): string {
    const content = blocks.map(contentSerializer).join("\n")
    return `
[.${isFreeformArray ? "+" : ""}${blockname}]
${content}
[]
`
}

function serializeRecircContent(content: BlockRecircValue): string {
    const list = serializeBlockList(
        "list",
        content.list,
        (b) => [...serializeStringProperties(Object.entries(b))].join("\n"),
        false
    )
    return `
${serializeKeyValue("title", content.title)}
${list}
`
}

function serializeRecirc(recirc: BlockRecirc): string {
    return serializeBlockList(
        recirc.type,
        recirc.value,
        serializeRecircContent,
        false
    )
}

function serializeChartStoryValue(value: ChartStoryValue): string {
    const narrative = serializeKeyValue("narrative", value.narrative)
    const chart = serializeKeyValue("chart", value.chart)
    const technicalText = serializeBlockList(
        "technical",
        value.technical!,
        (line) => `* ${line}`,
        false
    )
    return `
${narrative}
${chart}
${technicalText}
`
}

function serializeHeader(block: BlockHeader): string {
    return serializeObjectBlock(block.type, block.value, (header) =>
        [
            serializeKeyValue("text", header.text),
            serializeKeyValue("level", header.level.toString()),
        ].join("\n")
    )
}

const serializeOwidArticleBlockToArchieMLString = (
    block: OwidArticleBlock
): string => {
    const content = match(block)
        .with(
            { type: P.union("position", "url", "html", "text") },
            serializeSingleStringObject
        )
        .with({ type: "chart", value: P.string }, serializeSingleStringObject)
        .with({ type: "chart" }, (b) =>
            serializeStringOnlyObject({
                type: "chart",
                value: b.value as unknown as BlockChartValue,
            })
        )
        .with({ type: P.union("aside", "image") }, serializeStringOnlyObject)
        .with({ type: "scroller" }, (b) =>
            serializeBlockList(
                block.type,
                b.value,
                serializeOwidArticleBlockToArchieMLString,
                true
            )
        )
        .with({ type: "recirc" }, (b) => serializeRecirc(b))
        .with({ type: "chart-story" }, (b) =>
            serializeBlockList(
                block.type,
                b.value,
                serializeChartStoryValue,
                false
            )
        )
        .with({ type: "horizontal-rule" }, (b) =>
            serializeKeyValue(block.type, "<hr/>")
        )
        .with({ type: P.union("pull-quote", "list") }, (b) =>
            serializeBlockList(block.type, b.value, (line) => line, true)
        )
        .with({ type: "header" }, serializeHeader)
        .with({ type: "fixed-graphic" }, (b) =>
            serializeBlockList(
                block.type,
                b.value,
                serializeOwidArticleBlockToArchieMLString,
                true
            )
        )
        .exhaustive()
    return content
}

export function consolidateSpans(
    blocks: (OwidArticleBlock | OwidArticleEnrichedBlock)[]
): (OwidArticleBlock | BlockStructuredText)[] {
    const newBlocks: (OwidArticleBlock | OwidArticleEnrichedBlock)[] = []
    let currentBlock: BlockStructuredText | undefined = undefined
    for (const block of blocks) {
        if (block.type === "structured-text")
            if (currentBlock === undefined) currentBlock = block
            else
                currentBlock = {
                    type: "structured-text",
                    value: [...currentBlock.value, ...block.value],
                }
        else {
            if (currentBlock !== undefined) {
                newBlocks.push(currentBlock)
                currentBlock = undefined
                newBlocks.push(block)
            }
        }
    }
    return newBlocks
}

function flattenSpanToString(s: Span): string {
    return match(s)
        .with({ spanType: "span-simple-text" }, (span) => span.text)
        .with(
            { spanType: "span-link" },
            (span) =>
                `<a href="${span.url}">${tempFlattenSpansToString(
                    span.children
                )}</a>`
        )
        .with({ spanType: "span-newline" }, () => "</br>")
        .with(
            { spanType: "span-italic" },
            (span) => `<i>${tempFlattenSpansToString(span.children)}</i>`
        )
        .with(
            { spanType: "span-bold" },
            (span) => `<b>${tempFlattenSpansToString(span.children)}</b>`
        )
        .with(
            { spanType: "span-underline" },
            (span) => `<u>${tempFlattenSpansToString(span.children)}</u>`
        )
        .with(
            { spanType: "span-subscript" },
            (span) => `<sub>${tempFlattenSpansToString(span.children)}</sub>`
        )
        .with(
            { spanType: "span-superscript" },
            (span) => `<sup>${tempFlattenSpansToString(span.children)}</sup>`
        )
        .with(
            { spanType: "span-quote" },
            (span) => `<q>${tempFlattenSpansToString(span.children)}</q>`
        )
        .with(
            { spanType: "span-fallback" },
            (span) => `<span>${tempFlattenSpansToString(span.children)}</span>`
        )
        .exhaustive()
}

export function tempFlattenSpansToString(spans: Span[]): string {
    if (spans.length === 0) return ""
    else {
        const result = spans.map(flattenSpanToString).join("")
        return result
    }
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
                    ;(memo.body[memo.body.length - 1] as BlockList).value.push(
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
    imageHandler:
        | ((
              elementId: string,
              doc: docs_v1.Schema$Document
          ) => Promise<BlockImage>)
        | undefined
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
                        const header: BlockHeader = {
                            type: "header",
                            value: {
                                text: text.trim(),
                                level: Number.parseInt(headingLevel, 10),
                            },
                        }
                        return serializeOwidArticleBlockToArchieMLString(header)
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
                            serializeOwidArticleBlockToArchieMLString
                        )
                        .with({ spanType: P.any }, (s) =>
                            flattenSpanToString(s)
                        )
                        .with(P.nullish, () => "")
                        .exhaustive()
                    elementText += `${prefix}${fragmentText}`
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
    imageHandler?:
        | ((
              elementId: string,
              doc: docs_v1.Schema$Document
          ) => Promise<BlockImage>)
        | undefined
): Promise<Span | BlockHorizontalRule | BlockImage | null> {
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
