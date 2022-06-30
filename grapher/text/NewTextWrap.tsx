import React from "react"
import { Bounds, FontFamily } from "../../clientUtils/Bounds.js"
import { sum } from "../../clientUtils/Util.js"

interface FontParams {
    fontSize?: number
    fontWeight?: number
    fontFamily?: FontFamily
}

interface SplitParams {
    maxWidth: number
    fontParams?: FontParams
    includeFirst?: boolean
}

export interface IRToken {
    getWidth(fontParams?: FontParams): number
    toHTML(): JSX.Element | undefined
    toSVG(): JSX.Element | undefined
}

export class IRText implements IRToken {
    constructor(private text: string) {}
    // splitAt({
    //     maxWidth,
    //     fontParams,
    //     includeFirst,
    // }: SplitParams): [IRText | undefined, IRText | undefined] {
    //     const wordsThatFit: string[] = []
    //     const unprocessedWords: string[] = this.text.split(" ")
    //     if (includeFirst && unprocessedWords.length) {
    //         wordsThatFit.push(unprocessedWords.shift()!)
    //     }
    //     while (
    //         unprocessedWords.length &&
    //         Bounds.forText(
    //             wordsThatFit.concat([unprocessedWords[0]]).join(" "),
    //             fontParams
    //         ).width <= maxWidth
    //     ) {
    //         wordsThatFit.push(unprocessedWords.shift()!)
    //     }

    //     return [
    //         wordsThatFit.length
    //             ? new IRText(wordsThatFit.join(" "))
    //             : undefined,
    //         unprocessedWords.length
    //             ? new IRText(unprocessedWords.join(" "))
    //             : undefined,
    //     ]
    // }
    getWidth(fontParams?: FontParams): number {
        return Bounds.forText(this.text, fontParams).width
    }
    toHTML(): JSX.Element {
        return <React.Fragment>{this.text}</React.Fragment>
    }
    toSVG(): JSX.Element {
        return <React.Fragment>{this.text}</React.Fragment>
    }
}

export class IRWhitespace implements IRToken {
    getWidth(fontParams?: FontParams): number {
        return Bounds.forText(" ", fontParams).width
    }
    toHTML(): JSX.Element {
        // TODO change to space
        return <React.Fragment>&nbsp;</React.Fragment>
    }
    toSVG(): JSX.Element {
        // TODO change to space
        return <React.Fragment>&nbsp;</React.Fragment>
    }
}

export class IRLineBreak implements IRToken {
    getWidth(): number {
        return 0
    }
    toHTML(): JSX.Element {
        return <br />
    }
    toSVG(): undefined {
        // We have to deal with this special case in
        // whatever procedure does text reflow.
        return undefined
    }
}

abstract class IRElement implements IRToken {
    constructor(protected children: IRToken[]) {}

    getFontParams(fontParams?: FontParams): FontParams | undefined {
        return fontParams
    }

    getWidth(fontParams?: FontParams): number {
        return sum(
            this.children.map((token) =>
                token.getWidth(this.getFontParams(fontParams))
            )
        )
    }

    splitAt({
        fontParams,
        ...params
    }: SplitParams): [IRElement | undefined, IRElement | undefined] {
        const [elementThatFits, elementThatOverflows] = splitOnceAt({
            ...params,
            fontParams: this.getFontParams(fontParams),
            tokens: this.children,
        }).map((children) =>
            children.length ? this.getClone(children) : undefined
        )
        return [elementThatFits, elementThatOverflows]
    }

    abstract getClone(children: IRToken[]): IRElement
    abstract toHTML(): JSX.Element
    abstract toSVG(): JSX.Element
}

export class IRBold extends IRElement {
    getFontParams(fontParams?: FontParams | undefined): FontParams | undefined {
        return { ...fontParams, fontWeight: 700 }
    }
    getClone(children: IRToken[]): IRBold {
        return new IRBold(children)
    }
    toHTML(): JSX.Element {
        return <strong>{this.children.map((child) => child.toHTML())}</strong>
    }
    toSVG(): JSX.Element {
        return (
            <tspan style={{ fontWeight: 700 }}>
                {this.children.map((child) => child.toSVG())}
            </tspan>
        )
    }
}

export class IRItalic extends IRElement {
    getClone(children: IRToken[]): IRItalic {
        return new IRItalic(children)
    }
    toHTML(): JSX.Element {
        return <em>{this.children.map((child) => child.toHTML())}</em>
    }
    toSVG(): JSX.Element {
        return (
            <tspan style={{ fontStyle: "italic" }}>
                {this.children.map((child) => child.toSVG())}
            </tspan>
        )
    }
}

export class IRLink extends IRElement {
    constructor(public href: string, children: IRToken[]) {
        super(children)
    }
    getClone(children: IRToken[]): IRLink {
        return new IRLink(this.href, children)
    }
    toHTML(): JSX.Element {
        return (
            <a href={this.href}>
                {this.children.map((child) => child.toHTML())}
            </a>
        )
    }
    toSVG(): JSX.Element {
        return (
            <a href={this.href}>
                {this.children.map((child) => child.toSVG())}
            </a>
        )
    }
}

enum Action {
    Merge = "Merge",
    Split = "Split",
    Nothing = "Nothing",
}

function splitOnceAt({
    tokens,
    maxWidth,
    includeFirst,
    fontParams,
}: SplitParams & {
    tokens: IRToken[]
}): [IRToken[], IRToken[]] {
    const tokensThatFit: IRToken[] = []
    let tokensThatFitWidth = 0
    let unbreakableTokens: IRToken[] = []
    let unbreakableTokensWidth = 0
    const unprocessedTokens = [...tokens]

    while (unprocessedTokens.length) {
        const nextToken = unprocessedTokens.shift()!
        let encounteredBreak = false

        if (nextToken instanceof IRWhitespace) {
            if (tokensThatFitWidth + unbreakableTokensWidth <= maxWidth) {
                tokensThatFit.push(...unbreakableTokens)
                tokensThatFitWidth += unbreakableTokensWidth
                unbreakableTokens = [nextToken]
                unbreakableTokensWidth = nextToken.getWidth(fontParams)
            } else {
                encounteredBreak = true
            }
        } else if (nextToken instanceof IRLineBreak) {
            encounteredBreak = true
        } else if (nextToken instanceof IRElement) {
            const [tokenThatFits, tokenThatOverflows] = nextToken.splitAt({
                fontParams,
                maxWidth:
                    maxWidth - tokensThatFitWidth - unbreakableTokensWidth,
                includeFirst: includeFirst && tokensThatFit.length === 0,
            })
            if (tokenThatFits && tokenThatOverflows) {
                unbreakableTokens.push(tokenThatFits)
                unprocessedTokens.unshift(tokenThatOverflows)
                encounteredBreak = true
            } else if (tokenThatFits) {
                unbreakableTokens.push(tokenThatFits)
                unbreakableTokensWidth += nextToken.getWidth(fontParams)
            } else if (tokenThatOverflows) {
                unprocessedTokens.unshift(tokenThatOverflows)
                encounteredBreak = true
            }
        } else {
            unbreakableTokens.push(nextToken)
            unbreakableTokensWidth += nextToken.getWidth(fontParams)
        }

        if (encounteredBreak) {
            tokensThatFit.push(...unbreakableTokens)
            unbreakableTokens = []
            break
        } else if (
            tokensThatFit.length > 0 &&
            tokensThatFitWidth + unbreakableTokensWidth > maxWidth
        ) {
            unprocessedTokens.unshift(...trimLeft(unbreakableTokens))
            unbreakableTokens = []
            break
        }

        // token action:
        // 1. add token to unbreakable tokens
        //    ~~ - for whitespace, this is dependent on what the unbreakable tokens action is~~~
        //       don't need to worry, whitespace is trimmed
        // 2. consume token (make it disappear)
        //
        // unbreakable tokens action:
        // 1. add unbreakable tokens to tokens that fit
        // ~~2. move unbreakable tokens to new line~~ never need to worry, handled at top step
        // 3. do nothing
    }

    if (
        (tokensThatFit.length === 0 && includeFirst) ||
        tokensThatFitWidth + unbreakableTokensWidth <= maxWidth
    ) {
        tokensThatFit.push(...unbreakableTokens)
        unbreakableTokens = []
    } else {
        unprocessedTokens.unshift(...unbreakableTokens)
        unbreakableTokens = []
    }

    if (unbreakableTokens.length) {
        throw new Error("unbreakableTokens is not empty")
    }

    return [tokensThatFit, unprocessedTokens]
}

// Remove leading whitespace tokens from a list of tokens.
function trimLeft(tokens: IRToken[]): IRToken[] {
    let i = 0
    while (i < tokens.length && tokens[i] instanceof IRWhitespace) {
        i++
    }
    return tokens.slice(i)
}

// function splitOnceAt({
//     tokens,
//     maxWidth,
//     includeFirst,
//     fontParams,
// }: SplitParams & {
//     tokens: IRToken[]
// }): [IRToken[], IRToken[]] {
//     let tokensThatFitWidth = 0
//     const tokensThatFit: IRToken[] = []
//     let tokensSinceWhitespace: IRToken[] = []
//     let tokensSinceWhitespaceWidth = 0
//     const unprocessedTokens = [...tokens]
//     while (unprocessedTokens.length) {
//         const nextToken = unprocessedTokens.shift()!
//         if (nextToken instanceof IRLineBreak) break
//         const remainingWidth = maxWidth - tokensThatFitWidth
//         let encounteredBreak = false
//         if (nextToken instanceof IRElement) {
//             const [tokenThatFits, tokenThatOverflows] = nextToken.splitAt({
//                 maxWidth: remainingWidth,
//                 includeFirst: includeFirst && tokensThatFit.length === 0,
//                 fontParams,
//             })
//             if (tokenThatFits) {
//                 tokensSinceWhitespace.push(
//                     ...tokensSinceWhitespace,
//                     tokenThatFits
//                 )
//                 tokensSinceWhitespace = []
//             }
//             if (tokenThatOverflows) {
//                 encounteredBreak = true
//                 unprocessedTokens.unshift(tokenThatOverflows)
//             }
//         } else if (
//             nextToken instanceof IRWhitespace ||
//             unprocessedTokens.length === 0
//         ) {
//             if (
//                 (includeFirst && tokensThatFit.length === 0) ||
//                 tokensSinceWhitespaceWidth <= remainingWidth
//             ) {
//                 tokensThatFit.push(...tokensSinceWhitespace)
//                 tokensSinceWhitespace = [nextToken]
//                 tokensThatFitWidth += tokensSinceWhitespaceWidth
//             } else {
//                 unprocessedTokens.unshift(...tokensSinceWhitespace, nextToken)
//                 tokensSinceWhitespace = []
//                 encounteredBreak = true
//             }
//         } else {
//             tokensSinceWhitespace.push(nextToken)
//         }
//         if (encounteredBreak) {
//             unprocessedTokens.unshift(...tokensSinceWhitespace)
//             break
//         }
//     }
//     if (unprocessedTokens.length === 0) {
//         tokensThatFit.push(...tokensSinceWhitespace)
//     }
//     return [tokensThatFit, unprocessedTokens]
// }

// if (nextToken instanceof IRText) {
//     unbreakableTokens.push(nextToken)
//     unbreakableTokensWidth += nextToken.getWidth(fontParams)
// } else if (nextToken instanceof IRWhitespace) {
//     if (
//         tokensThatFitWidth + unbreakableTokensWidth <= maxWidth ||
//         (includeFirst && isFirstToken)
//     ) {
//         // Add to tokens that fit, without the trailing whitespace
//         tokensThatFit.push(...unbreakableTokens)
//         tokensThatFitWidth += unbreakableTokensWidth
//         // add whitespace as leading token
//         unbreakableTokens = [nextToken]
//         unbreakableTokensWidth = nextToken.getWidth(fontParams)
//     } else {
//         unprocessedTokens.unshift(
//             // remove any leading whitespace
//             ...trimLeft(unbreakableTokens),
//             nextToken
//         )
//         break
//     }
// }
// if (isLastToken) {
//     const tokenWidth = nextToken.getWidth(fontParams)
//     if (
//         tokensThatFitWidth + unbreakableTokensWidth + tokenWidth <=
//         maxWidth
//     ) {
//         tokensThatFit.push(...unbreakableTokens, nextToken)
//         // tokensThatFitWidth += tokensSinceWhitespaceWidth + tokenWidth
//         // tokensSinceWhitespace = [nextToken]
//         // tokensSinceWhitespaceWidth = nextToken.getWidth(fontParams)
//     } else {
//         unprocessedTokens.unshift(
//             ...trimLeft(unbreakableTokens),
//             nextToken
//         )
//         break
//     }
// }

// This should only be used in SVG, we should
// let HTML be rendered by the browser.
export function splitIntoLines(
    tokens: IRToken[],
    maxWidth: number
): IRToken[][] {
    const lines: IRToken[][] = []
    let unprocessedTokens: IRToken[] = [...tokens]
    while (unprocessedTokens.length) {
        const [tokensThatFit, tokensThatOverflow] = splitOnceAt({
            tokens: unprocessedTokens,
            maxWidth,
            includeFirst: true,
        })
        lines.push(tokensThatFit)
        unprocessedTokens = tokensThatOverflow
    }
    return lines
}
