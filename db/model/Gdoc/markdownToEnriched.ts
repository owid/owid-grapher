import {
    EnrichedBlockList,
    EnrichedBlockNumberedList,
    EnrichedBlockText,
    DodMarkdownSupportedBlock,
    ParseError,
    Span,
    SpanBold,
    SpanItalic,
    SpanLink,
    SpanNewline,
    SpanSimpleText,
} from "@ourworldindata/types"
import { Content, List, Paragraph, PhrasingContent } from "mdast"
import fromMarkdown from "mdast-util-from-markdown"
import { partition } from "remeda"
import { match, P } from "ts-pattern"

function checkIsParagraphBlock(block: Content): block is Paragraph {
    return block.type === "paragraph"
}

function paragraphToEnrichedTextBlock(block: Paragraph): EnrichedBlockText {
    const parsed = convertPhrasingContentToSpans(block.children)
    return {
        type: "text",
        value: parsed.spans,
        parseErrors: parsed.parseErrors,
    }
}

function listToEnrichedListBlock(
    block: List
): EnrichedBlockList | EnrichedBlockNumberedList {
    const parseErrors: ParseError[] = []

    const [paragraphChildren, nonParagraphChildren] = partition(
        block.children,
        checkIsParagraphBlock
    )

    if (nonParagraphChildren.length > 0) {
        parseErrors.push({
            message: `Unsupported list item type: ${nonParagraphChildren
                .map((child) => child.type)
                .join(", ")}`,
        })
    }

    return {
        type: block.ordered ? "numbered-list" : "list",
        items: paragraphChildren.map((child) =>
            paragraphToEnrichedTextBlock(child)
        ),
        parseErrors,
    }
}

function nodeToSpan(node: PhrasingContent): {
    value: Span | undefined
    parseErrors: ParseError[]
} {
    return match(node)
        .with({ type: "text" }, (node) => ({
            value: {
                spanType: "span-simple-text",
                text: node.value,
            } as SpanSimpleText,
            parseErrors: [],
        }))
        .with({ type: "emphasis" }, (node) => {
            const childResult = convertPhrasingContentToSpans(node.children)
            return {
                value: {
                    spanType: "span-italic",
                    children: childResult.spans,
                } as SpanItalic,
                parseErrors: childResult.parseErrors,
            }
        })
        .with({ type: "strong" }, (node) => {
            const childResult = convertPhrasingContentToSpans(node.children)
            return {
                value: {
                    spanType: "span-bold",
                    children: childResult.spans,
                } as SpanBold,
                parseErrors: childResult.parseErrors,
            }
        })
        .with({ type: "link" }, (node) => {
            const childResult = convertPhrasingContentToSpans(node.children)
            return {
                value: {
                    spanType: "span-link",
                    children: childResult.spans,
                    url: node.url,
                } as SpanLink,
                parseErrors: childResult.parseErrors,
            }
        })
        .with({ type: "break" }, () => ({
            value: {
                spanType: "span-newline",
            } as SpanNewline,
            parseErrors: [],
        }))
        .with(
            {
                type: P.union(
                    "linkReference",
                    "image",
                    "imageReference",
                    "html",
                    "footnote",
                    "footnoteReference",
                    "delete",
                    "inlineCode"
                ),
            },
            () => {
                // unsupported
                return {
                    value: undefined,
                    parseErrors: [
                        {
                            nodeType: node.type,
                            message: `Unsupported node type: ${node.type}`,
                        },
                    ],
                }
            }
        )
        .exhaustive()
}

function convertPhrasingContentToSpans(children: PhrasingContent[]): {
    spans: Span[]
    parseErrors: ParseError[]
} {
    const result = children.reduce(
        (acc, child) => {
            const nodeResult = nodeToSpan(child)

            // Collect all parse errors
            acc.parseErrors = [...acc.parseErrors, ...nodeResult.parseErrors]

            // Only add the span if it exists
            if (nodeResult.value) {
                acc.spans.push(nodeResult.value)
            }

            return acc
        },
        { spans: [] as Span[], parseErrors: [] as ParseError[] }
    )

    return result
}

function processMdastNode(node: Content): {
    value: DodMarkdownSupportedBlock | undefined
    parseErrors: ParseError[]
} {
    return match(node)
        .with({ type: "paragraph" }, (node) => {
            return {
                value: paragraphToEnrichedTextBlock(node),
                parseErrors: [],
            }
        })
        .with({ type: "list" }, (node) => {
            return {
                value: listToEnrichedListBlock(node),
                parseErrors: [],
            }
        })
        .with(
            {
                type: P.union(
                    "blockquote",
                    "heading",
                    "thematicBreak",
                    "blockquote",
                    "code",
                    "html",
                    "footnote",
                    "footnoteReference",
                    "linkReference",
                    "image",
                    "table",
                    "tableCell",
                    "tableRow",
                    "break",
                    "inlineCode",
                    "delete",
                    "imageReference",
                    "yaml",
                    "strong",
                    "link",
                    "listItem",
                    "text",
                    "emphasis",
                    "definition",
                    "footnoteDefinition"
                ),
            },
            () => ({
                value: undefined,
                parseErrors: [
                    {
                        message: `Unsupported block type: ${node.type} in position ${node.position?.start.line}:${node.position?.start.column}`,
                    },
                ],
            })
        )
        .exhaustive()
}

export function markdownToEnriched(markdown: string): {
    text: DodMarkdownSupportedBlock[]
    parseErrors: ParseError[]
} {
    const text = [] as DodMarkdownSupportedBlock[]
    const parseErrors: ParseError[] = []
    try {
        const ast = fromMarkdown(markdown)
        for (const node of ast.children) {
            const parsed = processMdastNode(node)
            if (parsed.value) {
                text.push(parsed.value)
            }
            parseErrors.push(...parsed.parseErrors)
        }
    } catch (e) {
        console.error("Failed to parse markdown", e)
        return {
            text: [],
            parseErrors: [
                {
                    message: "Failed to parse markdown",
                },
            ],
        }
    }
    return {
        text,
        parseErrors,
    }
}
