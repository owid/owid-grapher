import { CSSProperties } from "react"
import {
    imemo,
    Bounds,
    FontFamily,
    VerticalAlign,
    type RequiredBy,
} from "@ourworldindata/utils"
import { type ITextWrap } from "../TextWrap/TextWrap.js"
import { fromMarkdown } from "mdast-util-from-markdown"
import type { Root, RootContent } from "mdast"
import { match } from "ts-pattern"
import { urlRegex } from "../markdown/remarkPlainLinks.js"
import * as R from "remeda"
import {
    IRBold,
    IRDetailOnDemand,
    IRItalic,
    IRLineBreak,
    IRLink,
    IRText,
    IRWhitespace,
    type IRFontParams,
    type IRToken,
} from "./IRTokens.js"
import {
    AbstractTokenTextWrap,
    type TokenTextWrapOptions,
} from "./AbstractTokenTextWrap.js"

type MarkdownTextWrapOptions = {
    maxWidth?: number
    fontFamily?: FontFamily
    fontSize: number
    fontWeight?: number
    lineHeight?: number
    verticalAlign?: VerticalAlign
    style?: CSSProperties
    detailsOrderedByReference?: string[]
}

type MarkdownTextWrapProps = { text: string } & MarkdownTextWrapOptions

export class MarkdownTextWrap extends AbstractTokenTextWrap {
    private static readonly defaultOptions = {
        maxWidth: Infinity,
        lineHeight: 1.1,
        verticalAlign: VerticalAlign.bottom,
        detailsOrderedByReference: [] as string[],
    } as const satisfies Partial<MarkdownTextWrapProps>

    private readonly initialProps: MarkdownTextWrapProps
    constructor(props: MarkdownTextWrapProps) {
        super()
        this.initialProps = props
    }

    @imemo get props(): RequiredBy<
        MarkdownTextWrapProps,
        keyof typeof MarkdownTextWrap.defaultOptions
    > {
        return { ...MarkdownTextWrap.defaultOptions, ...this.initialProps }
    }

    protected get options(): TokenTextWrapOptions {
        return this.props
    }

    @imemo get text(): string {
        return normalizeMarkdownNewlines(this.props.text)
    }

    @imemo get tokens(): IRToken[] {
        return convertMarkdownToIRTokens(this.text, this.fontParams)
    }
}

/**
 * Normalizes newline variants into markdown hard line breaks.
 *
 * NOTE: ❗Here we deviate from the normal markdown spec. We replace \n with <SPACE><SPACE>\n to make sure that single \n are treated as
 * actual line breaks but only if none of the other markdown line break rules apply.
 * This is a bit different to how markdown usually works but we have a substantial
 * amount of legacy charts that use newlines in this way and it seems that it is
 * better to support this simple case than to do a data migration of many chart subtitles.
 */
export function normalizeMarkdownNewlines(baseText: string): string {
    // This replace is a bit funky - we want to make sure that single \n are treated as
    // actual line breaks but only if none of the other markdown line break rules apply.
    // These are:
    // - \n\n is always a new paragraph
    // - Two spaces before \n is a line break (this rule is not entirely checked as we only check for a single space)
    // - A backslash before \n is a line break
    // The code below normalizes all cases to <SPACE><SPACE>\n which will lead to them surviving the markdown parsing
    let text = baseText.trim()
    text = text.replaceAll("\n\n", "@@LINEBREAK@@")
    text = text.replaceAll("\\\n", "@@LINEBREAK@@")
    text = text.replaceAll("  \n", "@@LINEBREAK@@")
    text = text.replaceAll("\n", "  \n")
    text = text.replaceAll("@@LINEBREAK@@", "  \n")
    return text
}

export function convertMarkdownToIRTokens(
    markdown: string,
    fontParams?: IRFontParams
): IRToken[] {
    const ast: Root = fromMarkdown(markdown)
    const children = ast.children.flatMap((item) =>
        convertMarkdownNodeToIRTokens(item, fontParams)
    )
    // ensure that there are no leading or trailing line breaks
    return R.dropLastWhile(
        R.dropWhile(children, (token) => token instanceof IRLineBreak),
        (token) => token instanceof IRLineBreak
    )
}

// When using mdast types version 4 this should be typed as:
// node: RootContentMap[keyof RootContentMap]
function convertMarkdownNodeToIRTokens(
    node: RootContent,
    fontParams: IRFontParams = {}
): IRToken[] {
    const converted = match(node)
        .with(
            {
                type: "blockquote",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "break",
            },
            (_) => {
                return [new IRLineBreak()]
            }
        )
        .with(
            {
                type: "code",
            },
            (item) => {
                return [new IRText(item.value, fontParams)]
            }
        )
        .with(
            {
                type: "emphasis",
            },
            (item) => {
                return [
                    new IRItalic(
                        item.children.flatMap((child) =>
                            convertMarkdownNodeToIRTokens(child, {
                                ...fontParams,
                                isItalic: true,
                            })
                        )
                    ),
                ]
            }
        )
        .with(
            {
                type: "heading",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "html",
            },
            (item) => {
                return [new IRText(item.value, fontParams)]
            }
        )
        .with(
            {
                type: "image",
            },
            (item) => {
                return [new IRText(item.alt ?? "", fontParams)]
            }
        )
        .with(
            {
                type: "inlineCode",
            },
            (item) => {
                return [new IRText(item.value, fontParams)]
            }
        )
        .with(
            {
                type: "link",
            },
            (item) => {
                if (item.url.startsWith("#dod:")) {
                    const term = item.url.replace("#dod:", "")
                    return [
                        new IRDetailOnDemand(
                            term,
                            item.children.flatMap((child) =>
                                convertMarkdownNodeToIRTokens(child, fontParams)
                            ),
                            fontParams
                        ),
                    ]
                } else
                    return [
                        new IRLink(
                            item.url,
                            item.children.flatMap((child) =>
                                convertMarkdownNodeToIRTokens(child, fontParams)
                            )
                        ),
                    ]
            }
        )
        .with(
            {
                type: "list",
            },
            (item) => {
                if (item.ordered)
                    return item.children.flatMap((child, index) => [
                        new IRLineBreak(),
                        new IRText(`${index + 1}) `, fontParams),
                        ...convertMarkdownNodeToIRTokens(child, fontParams),
                    ])
                else
                    return item.children.flatMap((child) => [
                        new IRLineBreak(),
                        new IRText(`• `, fontParams),
                        ...convertMarkdownNodeToIRTokens(child, fontParams),
                    ])
            }
        )
        .with(
            {
                type: "listItem",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "paragraph",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "strong",
            },
            (item) => {
                return [
                    new IRBold(
                        item.children.flatMap((child) =>
                            convertMarkdownNodeToIRTokens(child, {
                                ...fontParams,
                                fontWeight: 700,
                            })
                        )
                    ),
                ]
            }
        )
        .with(
            {
                type: "text",
            },
            (item) => {
                const splitted = item.value.split(/\s+/)
                const tokens = splitted.flatMap((text, i) => {
                    const textNode = new IRText(text, fontParams)
                    const node = text.match(urlRegex)
                        ? new IRLink(text, [textNode], fontParams)
                        : textNode
                    if (i < splitted.length - 1) {
                        return [node, new IRWhitespace(fontParams)]
                    } else return [node]
                })
                return tokens
            }
        )
        .with(
            {
                type: "thematicBreak",
            },
            (_) => {
                return [new IRText("---", fontParams)]
            }
        )
        .with(
            {
                type: "delete",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        // Now lets finish this with blocks for FootnoteDefinition, Definition, ImageReference, LinkReference, FootnoteReference, and Table
        .with(
            {
                type: "footnoteDefinition",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "definition",
            },
            (item) => {
                return [
                    new IRText(`${item.identifier}: ${item.label}`, fontParams),
                ]
            }
        )
        .with(
            {
                type: "imageReference",
            },
            (item) => {
                return [
                    new IRText(`${item.identifier}: ${item.label}`, fontParams),
                ]
            }
        )
        .with(
            {
                type: "linkReference",
            },
            (item) => {
                return [
                    new IRText(`${item.identifier}: ${item.label}`, fontParams),
                ]
            }
        )
        .with(
            {
                type: "footnoteReference",
            },
            (item) => {
                return [
                    new IRText(`${item.identifier}: ${item.label}`, fontParams),
                ]
            }
        )
        .with(
            {
                type: "table",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "tableCell",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        // and now TableRow and Yaml
        .with(
            {
                type: "tableRow",
            },
            (item) => {
                return item.children.flatMap((child) =>
                    convertMarkdownNodeToIRTokens(child, fontParams)
                )
            }
        )
        .with(
            {
                type: "yaml",
            },
            (item) => {
                return [new IRText(item.value, fontParams)]
            }
        )
        .exhaustive()
    return converted
}

export function toPlaintext(markdown: string): string {
    return new MarkdownTextWrap({
        text: markdown,
        fontSize: 10, // doesn't matter, but is a mandatory field
    }).plaintext
}

/** Checks whether a piece of text fits on the last line of an existing text wrap */
export function canAppendTextToLastLine({
    existingTextWrap,
    textToAppend,
    reservedWidth = 0,
}: {
    existingTextWrap: ITextWrap
    textToAppend: string
    /** Width to reserve for non-text elements (e.g. icons) */
    reservedWidth?: number
}): boolean {
    const { maxWidth, lastLineWidth, fontSize, fontWeight, fontFamily } =
        existingTextWrap

    const spaceWidth = Bounds.forText(" ", { fontSize }).width
    const availableWidthInLastLine =
        maxWidth - lastLineWidth - spaceWidth - reservedWidth

    if (availableWidthInLastLine <= 0) return false

    const secondaryTextWrap = new MarkdownTextWrap({
        text: textToAppend,
        maxWidth: availableWidthInLastLine,
        fontSize,
        fontWeight,
        fontFamily,
    })

    return secondaryTextWrap.svgLines.length === 1
}
