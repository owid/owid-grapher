import SimpleMarkdown, { TextNode, SingleASTNode } from "simple-markdown"
import { isArray } from "../../clientUtils/Util.js"

const mdInlineParse = SimpleMarkdown.defaultInlineParse

type WhitespaceNode = {
    type: "whitespace"
}

type ExtendedNode = SingleASTNode | WhitespaceNode

// recursively split tree of text tokens
function splitTextTokens(
    tokens: ExtendedNode[],
    delimiter: string | RegExp,
    injectToken: ExtendedNode
): ExtendedNode[] {
    const result: ExtendedNode[] = []
    for (const token of tokens) {
        if (token.type === "text") {
            const tokens = (token.content as string)
                .split(delimiter)
                .map((content): TextNode => ({ type: "text", content }))
            result.push(
                ...injectInBetweenConsecutiveElements(
                    tokens,
                    injectToken
                ).filter(
                    (token) => !(token.type === "text" && token.content === "")
                )
            )
        } else if (token.hasOwnProperty("content")) {
            result.push({
                ...token,
                content: splitTextTokens(
                    (token as any).content,
                    delimiter,
                    injectToken
                ),
            } as any)
        } else {
            result.push(token)
        }
    }
    return result
}

// inject an element in between all consecutive elements
function injectInBetweenConsecutiveElements<T, Node extends ExtendedNode>(
    array: T[],
    element: Node
): (T | Node)[] {
    const result: (T | Node)[] = []
    for (let i = 0; i < array.length; i++) {
        if (i > 0) {
            result.push(element)
        }
        result.push(array[i])
    }
    return result
}

export function mdParse(
    source: string,
    state?: SimpleMarkdown.OptionalState
): ExtendedNode[] {
    let tokens: ExtendedNode[] = mdInlineParse(source, state)
    tokens = splitTextTokens(tokens, / +/g, { type: "whitespace" })
    tokens = splitTextTokens(tokens, "\n", { type: "br" })
    return tokens
}
