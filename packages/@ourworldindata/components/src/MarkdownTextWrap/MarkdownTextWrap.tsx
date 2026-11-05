import { imemo, Bounds } from "@ourworldindata/utils"
import { type ITextWrap } from "../TextWrap/TextWrap.js"
import { fromMarkdown } from "mdast-util-from-markdown"
import type { Root, RootContent } from "mdast"
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
    type TokenTextWrapProps,
} from "./AbstractTokenTextWrap.js"

type MarkdownTextWrapProps = { text: string } & TokenTextWrapProps

export class MarkdownTextWrap extends AbstractTokenTextWrap<MarkdownTextWrapProps> {
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

function convertMarkdownNodeToIRTokens(
    node: RootContent,
    fontParams: IRFontParams = {}
): IRToken[] {
    const convertChildren = (
        parent: { children: RootContent[] },
        childFontParams: IRFontParams = fontParams
    ): IRToken[] =>
        parent.children.flatMap((child) =>
            convertMarkdownNodeToIRTokens(child, childFontParams)
        )

    switch (node.type) {
        // Nodes that just contain other nodes
        case "blockquote":
        case "heading":
        case "listItem":
        case "paragraph":
        case "delete":
        case "footnoteDefinition":
        case "table":
        case "tableCell":
        case "tableRow":
            return convertChildren(node)

        case "break":
            return [new IRLineBreak()]

        // Nodes whose value is rendered as plain text
        case "code":
        case "html":
        case "inlineCode":
        case "yaml":
            return [new IRText(node.value, fontParams)]

        case "emphasis":
            return [
                new IRItalic(
                    convertChildren(node, { ...fontParams, isItalic: true })
                ),
            ]

        case "image":
            return [new IRText(node.alt ?? "", fontParams)]

        case "link":
            if (node.url.startsWith("#dod:")) {
                const term = node.url.replace("#dod:", "")
                return [
                    new IRDetailOnDemand(
                        term,
                        convertChildren(node),
                        fontParams
                    ),
                ]
            }
            return [new IRLink(node.url, convertChildren(node))]

        case "list":
            if (node.ordered)
                return node.children.flatMap((child, index) => [
                    new IRLineBreak(),
                    new IRText(`${index + 1}) `, fontParams),
                    ...convertMarkdownNodeToIRTokens(child, fontParams),
                ])
            return node.children.flatMap((child) => [
                new IRLineBreak(),
                new IRText(`• `, fontParams),
                ...convertMarkdownNodeToIRTokens(child, fontParams),
            ])

        case "strong":
            return [
                new IRBold(
                    convertChildren(node, { ...fontParams, fontWeight: 700 })
                ),
            ]

        case "text": {
            const splitted = node.value.split(/\s+/)
            return splitted.flatMap((text, i) => {
                const textNode = new IRText(text, fontParams)
                const tokenNode = text.match(urlRegex)
                    ? new IRLink(text, [textNode], fontParams)
                    : textNode
                if (i < splitted.length - 1) {
                    return [tokenNode, new IRWhitespace(fontParams)]
                }
                return [tokenNode]
            })
        }

        case "thematicBreak":
            return [new IRText("---", fontParams)]

        case "definition":
        case "imageReference":
        case "linkReference":
        case "footnoteReference":
            return [new IRText(`${node.identifier}: ${node.label}`, fontParams)]
    }
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
