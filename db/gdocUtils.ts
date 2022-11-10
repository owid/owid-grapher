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

function appendDotEndIfMultiline(line: string): string {
    if (line.includes("\n")) return line + "\n.end"
    return line
}

export function keyValueToArchieMlString(key: string, val: string): string {
    return `${key}: ${appendDotEndIfMultiline(val)}`
}

export function* stringPropertiesToArchieMlString(
    properties: [string, string][]
) {
    for (const [k, v] of properties) {
        yield keyValueToArchieMlString(k, v)
    }
}

export function objectBlockToArchieMlString<T>(
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

export function stringOnlyObjectToArchieMlString(obj: {
    type: string
    value: Record<string, string>
}): string {
    const serializeFn = (b: Record<string, string>) =>
        [...stringPropertiesToArchieMlString(Object.entries(b))].join("\n")
    return objectBlockToArchieMlString(obj.type, obj.value, serializeFn)
}

export function singleStringObjectToArchieMlString(obj: {
    type: string
    value: string
}): string {
    return keyValueToArchieMlString(obj.type, obj.value)
}

export function blockListToArchieMlString<T>(
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

export function recircContentToArchieMlString(
    content: BlockRecircValue
): string {
    const list = blockListToArchieMlString(
        "list",
        content.list,
        (b) =>
            [...stringPropertiesToArchieMlString(Object.entries(b))].join("\n"),
        false
    )
    return `
${keyValueToArchieMlString("title", content.title)}
${list}
`
}

export function recircToArchieMlString(recirc: BlockRecirc): string {
    return blockListToArchieMlString(
        recirc.type,
        recirc.value,
        recircContentToArchieMlString,
        false
    )
}

export function chartStoryValueToArchieMlString(
    value: ChartStoryValue
): string {
    const narrative = keyValueToArchieMlString("narrative", value.narrative)
    const chart = keyValueToArchieMlString("chart", value.chart)
    const technicalText = blockListToArchieMlString(
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

export function headerToArchieMlString(block: BlockHeader): string {
    return objectBlockToArchieMlString(block.type, block.value, (header) =>
        [
            keyValueToArchieMlString("text", header.text),
            keyValueToArchieMlString("level", header.level.toString()),
        ].join("\n")
    )
}

export const owidArticleBlockToArchieMLString = (
    block: OwidArticleBlock
): string => {
    const content = match(block)
        .with(
            { type: P.union("position", "url", "html", "text") },
            singleStringObjectToArchieMlString
        )
        .with(
            { type: "chart", value: P.string },
            singleStringObjectToArchieMlString
        )
        .with({ type: "chart" }, (b) =>
            stringOnlyObjectToArchieMlString({
                type: "chart",
                value: b.value as unknown as BlockChartValue,
            })
        )
        .with(
            { type: P.union("aside", "image") },
            stringOnlyObjectToArchieMlString
        )
        .with({ type: "scroller" }, (b) =>
            blockListToArchieMlString(
                block.type,
                b.value,
                owidArticleBlockToArchieMLString,
                true
            )
        )
        .with({ type: "recirc" }, (b) => recircToArchieMlString(b))
        .with({ type: "chart-story" }, (b) =>
            blockListToArchieMlString(
                block.type,
                b.value,
                chartStoryValueToArchieMlString,
                false
            )
        )
        .with({ type: "horizontal-rule" }, (b) =>
            keyValueToArchieMlString(block.type, "<hr/>")
        )
        .with({ type: P.union("pull-quote", "list") }, (b) =>
            blockListToArchieMlString(block.type, b.value, (line) => line, true)
        )
        .with({ type: "header" }, headerToArchieMlString)
        .with({ type: "fixed-graphic" }, (b) =>
            blockListToArchieMlString(
                block.type,
                b.value,
                owidArticleBlockToArchieMLString,
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

export function spanToHtmlString(s: Span): string {
    return match(s)
        .with({ spanType: "span-simple-text" }, (span) => span.text)
        .with(
            { spanType: "span-link" },
            (span) =>
                `<a href="${span.url}">${spansToHtmlString(span.children)}</a>`
        )
        .with({ spanType: "span-newline" }, () => "</br>")
        .with(
            { spanType: "span-italic" },
            (span) => `<i>${spansToHtmlString(span.children)}</i>`
        )
        .with(
            { spanType: "span-bold" },
            (span) => `<b>${spansToHtmlString(span.children)}</b>`
        )
        .with(
            { spanType: "span-underline" },
            (span) => `<u>${spansToHtmlString(span.children)}</u>`
        )
        .with(
            { spanType: "span-subscript" },
            (span) => `<sub>${spansToHtmlString(span.children)}</sub>`
        )
        .with(
            { spanType: "span-superscript" },
            (span) => `<sup>${spansToHtmlString(span.children)}</sup>`
        )
        .with(
            { spanType: "span-quote" },
            (span) => `<q>${spansToHtmlString(span.children)}</q>`
        )
        .with(
            { spanType: "span-fallback" },
            (span) => `<span>${spansToHtmlString(span.children)}</span>`
        )
        .exhaustive()
}

export function spansToHtmlString(spans: Span[]): string {
    if (spans.length === 0) return ""
    else {
        const result = spans.map(spanToHtmlString).join("")
        return result
    }
}
