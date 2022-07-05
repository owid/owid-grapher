import { MarkdownRoot } from "./parser.js"
import {
    IRText,
    IRWhitespace,
    IRBold,
    IRItalic,
    IRLineBreak,
    IRLink,
    IRToken,
    IRFontParams,
    IRSpan,
} from "./TextTokens.js"

export function parsimmonToTextTokens(
    nodes: MarkdownRoot["children"],
    fontParams?: IRFontParams
): IRToken[] {
    return nodes.map((node): IRToken => {
        if (node.type === "text") {
            return new IRText(node.value, fontParams)
        } else if (node.type === "newline") {
            return new IRLineBreak()
        } else if (node.type === "whitespace") {
            return new IRWhitespace(fontParams)
        } else if (node.type === "bold" || node.type === "plainBold") {
            return new IRBold(
                parsimmonToTextTokens((node as any).children, {
                    ...fontParams,
                    fontWeight: 700,
                })
            )
        } else if (node.type === "italic" || node.type === "plainItalic") {
            return new IRItalic(
                parsimmonToTextTokens((node as any).children, {
                    ...fontParams,
                })
            )
        } else if (node.type === "textSegments") {
            return new IRSpan(
                parsimmonToTextTokens((node as any).children, {
                    ...fontParams,
                })
            )
        } else if (node.type === "plainUrl") {
            return new IRLink(
                node.href,
                parsimmonToTextTokens(
                    [{ type: "text", value: node.href }],
                    fontParams
                )
            )
        } else if (node.type === "markdownLink") {
            return new IRLink(
                node.href,
                parsimmonToTextTokens(node.children, fontParams)
            )
        } else if (node.type === "detailOnDemand") {
            // TODO: create a IR for this
            return new IRLink(
                node.term,
                parsimmonToTextTokens(node.children, fontParams)
            )
        } else {
            throw new Error(`Unknown node type: ${(node as any).type}`)
        }
    })
}
