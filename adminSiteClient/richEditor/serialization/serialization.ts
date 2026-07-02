import {
    BlockPositionChoice,
    BlockSize,
    BlockVisibility,
    EnrichedBlockBlockquote,
    EnrichedBlockCallout,
    EnrichedBlockHeading,
    EnrichedBlockImage,
    EnrichedBlockList,
    EnrichedBlockNumberedList,
    EnrichedBlockText,
    OwidEnrichedGdocBlock,
    Span,
    SpanCallout,
} from "@ourworldindata/types"
import {
    PmMarkJson,
    PmNodeJson,
    pmMarkNames,
    pmNodeNames,
    propsAtomBlockTypes,
    twoColumnBlockTypes,
} from "./pmJson.js"
import {
    RunMark,
    RunMarkType,
    SpanRun,
    runsToSpanTree,
    spanTreeToRuns,
} from "./spanRuns.js"

/** null and undefined are both "absent" for ProseMirror attribute values */
function isPresent(value: unknown): boolean {
    return value !== null && value !== undefined
}

// Converts between the enriched gdoc block model (OwidEnrichedGdocBlock[]) and
// ProseMirror document JSON. Block types the editor supports natively get real
// ProseMirror nodes; every other block type is carried through opaquely as a
// `rawBlock` node so that no document is ever uneditable or lossy.

const SIMPLE_MARKS: Partial<Record<RunMarkType, string>> = {
    bold: pmMarkNames.bold,
    italic: pmMarkNames.italic,
    underline: pmMarkNames.underline,
    subscript: pmMarkNames.subscript,
    superscript: pmMarkNames.superscript,
    spanQuote: pmMarkNames.spanQuote,
    spanFallback: pmMarkNames.spanFallback,
}

function runMarkToPmMark(mark: RunMark): PmMarkJson {
    const simple = SIMPLE_MARKS[mark.type]
    if (simple) return { type: simple }
    switch (mark.type) {
        case "link":
            return { type: pmMarkNames.link, attrs: { url: mark.url ?? "" } }
        case "ref":
            return { type: pmMarkNames.ref, attrs: { url: mark.url ?? "" } }
        case "guidedChartLink":
            return {
                type: pmMarkNames.guidedChartLink,
                attrs: { url: mark.url ?? "" },
            }
        case "dod":
            return { type: pmMarkNames.dod, attrs: { id: mark.id ?? "" } }
        default:
            throw new Error(`Unhandled run mark type: ${mark.type}`)
    }
}

function pmMarkToRunMark(mark: PmMarkJson): RunMark {
    const simpleEntry = Object.entries(SIMPLE_MARKS).find(
        ([, pmName]) => pmName === mark.type
    )
    if (simpleEntry) return { type: simpleEntry[0] as RunMarkType }
    const attrs = mark.attrs ?? {}
    switch (mark.type) {
        case pmMarkNames.link:
            return { type: "link", url: String(attrs.url ?? "") }
        case pmMarkNames.ref:
            return { type: "ref", url: String(attrs.url ?? "") }
        case pmMarkNames.guidedChartLink:
            return { type: "guidedChartLink", url: String(attrs.url ?? "") }
        case pmMarkNames.dod:
            return { type: "dod", id: String(attrs.id ?? "") }
        default:
            throw new Error(`Unhandled ProseMirror mark type: ${mark.type}`)
    }
}

function runsToPmInline(runs: SpanRun[]): PmNodeJson[] {
    const nodes: PmNodeJson[] = []
    for (const run of runs) {
        const marks =
            run.marks.length > 0 ? run.marks.map(runMarkToPmMark) : undefined
        if (run.kind === "text") {
            nodes.push({ type: pmNodeNames.text, text: run.text, marks })
        } else if (run.kind === "newline") {
            nodes.push({ type: pmNodeNames.hardBreak, marks })
        } else {
            nodes.push({
                type: pmNodeNames.spanCallout,
                attrs: {
                    functionName: run.span.functionName,
                    parameters: structuredClone(run.span.parameters),
                    children: structuredClone(run.span.children),
                },
                marks,
            })
        }
    }
    return nodes
}

// Marks that only exist in the editing surface (e.g. comment highlights) and
// must never leak into the enriched content
const EDITOR_ONLY_MARKS = new Set<string>(["comment"])

function pmInlineToRuns(nodes: PmNodeJson[] | undefined): SpanRun[] {
    const runs: SpanRun[] = []
    for (const node of nodes ?? []) {
        const marks = (node.marks ?? [])
            .filter((mark) => !EDITOR_ONLY_MARKS.has(mark.type))
            .map(pmMarkToRunMark)
        if (node.type === pmNodeNames.text) {
            if (node.text) runs.push({ kind: "text", text: node.text, marks })
        } else if (node.type === pmNodeNames.hardBreak) {
            runs.push({ kind: "newline", marks })
        } else if (node.type === pmNodeNames.spanCallout) {
            const attrs = node.attrs ?? {}
            const span: SpanCallout = {
                spanType: "span-callout",
                functionName: attrs.functionName as SpanCallout["functionName"],
                parameters: structuredClone(
                    (attrs.parameters ?? []) as string[]
                ),
                children: structuredClone((attrs.children ?? []) as Span[]),
            }
            runs.push({ kind: "callout", span, marks })
        } else {
            throw new Error(`Unhandled inline node type: ${node.type}`)
        }
    }
    return runs
}

function spansToInlineContent(spans: Span[]): PmNodeJson[] | undefined {
    const inline = runsToPmInline(spanTreeToRuns(spans))
    return inline.length > 0 ? inline : undefined
}

function inlineContentToSpans(nodes: PmNodeJson[] | undefined): Span[] {
    return runsToSpanTree(pmInlineToRuns(nodes))
}

function textBlockToParagraph(block: EnrichedBlockText): PmNodeJson {
    return {
        type: pmNodeNames.paragraph,
        content: spansToInlineContent(block.value),
    }
}

function paragraphToTextBlock(node: PmNodeJson): EnrichedBlockText {
    return {
        type: "text",
        value: inlineContentToSpans(node.content),
        parseErrors: [],
    }
}

function listToPmNode(
    block: EnrichedBlockList | EnrichedBlockNumberedList
): PmNodeJson {
    return {
        type:
            block.type === "list"
                ? pmNodeNames.bulletList
                : pmNodeNames.orderedList,
        content: block.items.map((item) => ({
            type: pmNodeNames.listItem,
            content: [textBlockToParagraph(item)],
        })),
    }
}

function pmListItemsToTextBlocks(node: PmNodeJson): EnrichedBlockText[] {
    const items: EnrichedBlockText[] = []
    for (const listItem of node.content ?? []) {
        for (const paragraph of listItem.content ?? []) {
            items.push(paragraphToTextBlock(paragraph))
        }
    }
    return items
}

function calloutChildToPmNode(
    block: EnrichedBlockCallout["text"][number]
): PmNodeJson {
    if (block.type === "text") return textBlockToParagraph(block)
    if (block.type === "heading") return headingToPmNode(block)
    return listToPmNode(block)
}

function pmNodeToCalloutChild(
    node: PmNodeJson
): EnrichedBlockCallout["text"][number] {
    if (node.type === pmNodeNames.paragraph) return paragraphToTextBlock(node)
    if (node.type === pmNodeNames.heading)
        return pmNodeToHeading(node) as EnrichedBlockHeading
    if (node.type === pmNodeNames.bulletList) {
        return {
            type: "list",
            items: pmListItemsToTextBlocks(node),
            parseErrors: [],
        }
    }
    throw new Error(`Unhandled callout child node type: ${node.type}`)
}

function headingToPmNode(block: EnrichedBlockHeading): PmNodeJson {
    return {
        type: pmNodeNames.heading,
        attrs: {
            level: block.level,
            supertitle: block.supertitle
                ? structuredClone(block.supertitle)
                : null,
        },
        content: spansToInlineContent(block.text),
    }
}

function pmNodeToHeading(node: PmNodeJson): OwidEnrichedGdocBlock {
    const attrs = node.attrs ?? {}
    const supertitle = attrs.supertitle
        ? structuredClone(attrs.supertitle as Span[])
        : undefined
    return {
        type: "heading",
        text: inlineContentToSpans(node.content),
        ...(supertitle ? { supertitle } : {}),
        level: Number(attrs.level ?? 1),
        parseErrors: [],
    }
}

const nodeNameToPropsAtomBlockType = Object.fromEntries(
    Object.entries(propsAtomBlockTypes).map(([blockType, nodeName]) => [
        nodeName,
        blockType,
    ])
)

const nodeNameToTwoColumnBlockType = Object.fromEntries(
    Object.entries(twoColumnBlockTypes).map(([blockType, nodeName]) => [
        nodeName,
        blockType,
    ])
)

function propsAtomToPmNode(block: OwidEnrichedGdocBlock): PmNodeJson {
    const { parseErrors: _parseErrors, ...props } = block as Record<
        string,
        unknown
    > & { parseErrors?: unknown }
    delete props.type
    return {
        type: propsAtomBlockTypes[
            block.type as keyof typeof propsAtomBlockTypes
        ],
        attrs: { props: structuredClone(props) },
    }
}

function twoColumnToPmNode(
    block: OwidEnrichedGdocBlock & {
        left: OwidEnrichedGdocBlock[]
        right: OwidEnrichedGdocBlock[]
    }
): PmNodeJson {
    return {
        type: twoColumnBlockTypes[
            block.type as keyof typeof twoColumnBlockTypes
        ],
        content: [
            {
                type: pmNodeNames.layoutColumn,
                attrs: { side: "left" },
                content: block.left.map(enrichedBlockToPmNode),
            },
            {
                type: pmNodeNames.layoutColumn,
                attrs: { side: "right" },
                content: block.right.map(enrichedBlockToPmNode),
            },
        ],
    }
}

/** Convert one enriched block to a ProseMirror node. */
export function enrichedBlockToPmNode(
    block: OwidEnrichedGdocBlock
): PmNodeJson {
    if (block.type in propsAtomBlockTypes) return propsAtomToPmNode(block)
    if (block.type in twoColumnBlockTypes) {
        return twoColumnToPmNode(
            block as OwidEnrichedGdocBlock & {
                left: OwidEnrichedGdocBlock[]
                right: OwidEnrichedGdocBlock[]
            }
        )
    }
    switch (block.type) {
        case "aside":
            return {
                type: pmNodeNames.aside,
                attrs: { position: block.position ?? null },
                content: spansToInlineContent(block.caption),
            }
        case "gray-section":
            return {
                type: pmNodeNames.graySection,
                content: block.items.map(enrichedBlockToPmNode),
            }
        case "expandable-paragraph":
            return {
                type: pmNodeNames.expandableParagraph,
                content: block.items.map(enrichedBlockToPmNode),
            }
        case "text":
            return textBlockToParagraph(block)
        case "heading":
            return headingToPmNode(block)
        case "list":
        case "numbered-list":
            return listToPmNode(block)
        case "horizontal-rule":
            return { type: pmNodeNames.horizontalRule }
        case "blockquote":
            return {
                type: pmNodeNames.blockquote,
                attrs: { citation: block.citation ?? null },
                content: block.text.map(textBlockToParagraph),
            }
        case "callout":
            return {
                type: pmNodeNames.callout,
                attrs: {
                    icon: block.icon ?? null,
                    title: block.title ?? null,
                },
                content: block.text.map(calloutChildToPmNode),
            }
        case "image":
            return {
                type: pmNodeNames.image,
                attrs: {
                    filename: block.filename,
                    smallFilename: block.smallFilename ?? null,
                    alt: block.alt ?? null,
                    caption: block.caption
                        ? structuredClone(block.caption)
                        : null,
                    originalWidth: block.originalWidth ?? null,
                    size: block.size,
                    hasOutline: block.hasOutline,
                    visibility: block.visibility ?? null,
                    preferSmallFilename: block.preferSmallFilename ?? null,
                },
            }
        case "cta":
            return {
                type: pmNodeNames.cta,
                attrs: { text: block.text, url: block.url },
            }
        default:
            return {
                type: pmNodeNames.rawBlock,
                attrs: { block: structuredClone(block) },
            }
    }
}

/** Convert one ProseMirror node back to an enriched block. */
export function pmNodeToEnrichedBlock(node: PmNodeJson): OwidEnrichedGdocBlock {
    const attrs = node.attrs ?? {}
    const propsAtomType = nodeNameToPropsAtomBlockType[node.type]
    if (propsAtomType) {
        return {
            ...structuredClone(attrs.props as Record<string, unknown>),
            type: propsAtomType,
            parseErrors: [],
        } as unknown as OwidEnrichedGdocBlock
    }
    const twoColumnType = nodeNameToTwoColumnBlockType[node.type]
    if (twoColumnType) {
        const columns = node.content ?? []
        return {
            type: twoColumnType,
            left: (columns[0]?.content ?? []).map(pmNodeToEnrichedBlock),
            right: (columns[1]?.content ?? []).map(pmNodeToEnrichedBlock),
            parseErrors: [],
        } as OwidEnrichedGdocBlock
    }
    switch (node.type) {
        case pmNodeNames.aside: {
            const aside: OwidEnrichedGdocBlock = {
                type: "aside",
                caption: inlineContentToSpans(node.content),
                parseErrors: [],
            }
            if (isPresent(attrs.position))
                aside.position = attrs.position as BlockPositionChoice
            return aside
        }
        case pmNodeNames.graySection:
            return {
                type: "gray-section",
                items: (node.content ?? []).map(pmNodeToEnrichedBlock),
                parseErrors: [],
            }
        case pmNodeNames.expandableParagraph:
            return {
                type: "expandable-paragraph",
                items: (node.content ?? []).map(pmNodeToEnrichedBlock),
                parseErrors: [],
            }
        case pmNodeNames.paragraph:
            return paragraphToTextBlock(node)
        case pmNodeNames.heading:
            return pmNodeToHeading(node)
        case pmNodeNames.bulletList:
            return {
                type: "list",
                items: pmListItemsToTextBlocks(node),
                parseErrors: [],
            }
        case pmNodeNames.orderedList:
            return {
                type: "numbered-list",
                items: pmListItemsToTextBlocks(node),
                parseErrors: [],
            }
        case pmNodeNames.horizontalRule:
            return { type: "horizontal-rule", parseErrors: [] }
        case pmNodeNames.blockquote: {
            const blockquote: EnrichedBlockBlockquote = {
                type: "blockquote",
                text: (node.content ?? []).map(paragraphToTextBlock),
                parseErrors: [],
            }
            if (isPresent(attrs.citation))
                blockquote.citation = String(attrs.citation)
            return blockquote
        }
        case pmNodeNames.callout: {
            const callout: EnrichedBlockCallout = {
                type: "callout",
                text: (node.content ?? []).map(pmNodeToCalloutChild),
                parseErrors: [],
            }
            if (isPresent(attrs.icon)) callout.icon = attrs.icon as "info"
            if (isPresent(attrs.title)) callout.title = String(attrs.title)
            return callout
        }
        case pmNodeNames.image: {
            const image: EnrichedBlockImage = {
                type: "image",
                filename: String(attrs.filename ?? ""),
                size: (attrs.size ?? BlockSize.Wide) as BlockSize,
                hasOutline: Boolean(attrs.hasOutline),
                parseErrors: [],
            }
            if (isPresent(attrs.smallFilename))
                image.smallFilename = String(attrs.smallFilename)
            if (isPresent(attrs.alt)) image.alt = String(attrs.alt)
            if (attrs.caption)
                image.caption = structuredClone(attrs.caption as Span[])
            if (isPresent(attrs.originalWidth))
                image.originalWidth = Number(attrs.originalWidth)
            if (attrs.visibility)
                image.visibility = attrs.visibility as BlockVisibility
            if (isPresent(attrs.preferSmallFilename))
                image.preferSmallFilename = Boolean(attrs.preferSmallFilename)
            return image
        }
        case pmNodeNames.cta:
            return {
                type: "cta",
                text: String(attrs.text ?? ""),
                url: String(attrs.url ?? ""),
                parseErrors: [],
            }
        case pmNodeNames.rawBlock:
            return structuredClone(attrs.block) as OwidEnrichedGdocBlock
        default:
            throw new Error(`Unhandled ProseMirror node type: ${node.type}`)
    }
}

/** Convert an enriched gdoc body to a ProseMirror document. */
export function enrichedBlocksToPmDoc(
    blocks: OwidEnrichedGdocBlock[]
): PmNodeJson {
    return {
        type: pmNodeNames.doc,
        content: blocks.map(enrichedBlockToPmNode),
    }
}

/** Convert a ProseMirror document back to an enriched gdoc body. */
export function pmDocToEnrichedBlocks(
    doc: PmNodeJson
): OwidEnrichedGdocBlock[] {
    return (doc.content ?? []).map(pmNodeToEnrichedBlock)
}
