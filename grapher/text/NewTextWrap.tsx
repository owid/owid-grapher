import React from "react"
import { Bounds } from "../../clientUtils/Bounds.js"
import { sum } from "../../clientUtils/Util.js"

interface FontParams {
    fontSize?: number
    fontWeight?: number
    fontFamily?: string
}

interface SplitParams {
    maxWidth: number
    fontParams?: FontParams
    includeFirst?: boolean
}

export interface IRToken {
    getWidth(fontParams?: FontParams): number
    splitAt(props: SplitParams): [IRToken | undefined, IRToken | undefined]
    toHTML(): JSX.Element | undefined
    toSVG(): JSX.Element | undefined
}

export class IRText implements IRToken {
    constructor(private text: string) {}
    splitAt({
        maxWidth,
        fontParams,
        includeFirst,
    }: SplitParams): [IRText | undefined, IRText | undefined] {
        const wordsThatFit: string[] = []
        const unprocessedWords: string[] = this.text.split(" ")
        if (includeFirst && unprocessedWords.length) {
            wordsThatFit.push(unprocessedWords.shift()!)
        }
        while (
            unprocessedWords.length &&
            Bounds.forText(
                wordsThatFit.concat([unprocessedWords[0]]).join(" "),
                fontParams
            ).width <= maxWidth
        ) {
            wordsThatFit.push(unprocessedWords.shift()!)
        }

        return [
            wordsThatFit.length
                ? new IRText(wordsThatFit.join(" "))
                : undefined,
            unprocessedWords.length
                ? new IRText(unprocessedWords.join(" "))
                : undefined,
        ]
    }
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

export class IRLineBreak implements IRToken {
    getWidth(): number {
        return 0
    }
    splitAt(): [undefined, undefined] {
        // We have to deal with this special case in
        // whatever procedure does text reflow.
        return [undefined, undefined]
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

function splitOnceAt({
    tokens,
    maxWidth,
    includeFirst,
    fontParams,
}: SplitParams & {
    tokens: IRToken[]
}): [IRToken[], IRToken[]] {
    let currentWidth = 0
    const tokensThatFit: IRToken[] = []
    const unprocessedTokens = [...tokens]
    while (unprocessedTokens.length) {
        const nextToken = unprocessedTokens.shift()!
        if (nextToken instanceof IRLineBreak) break
        const remainingWidth = maxWidth - currentWidth
        const [tokenThatFits, tokenThatOverflows] = nextToken.splitAt({
            maxWidth: remainingWidth,
            includeFirst: includeFirst && tokensThatFit.length === 0,
            fontParams,
        })
        if (tokenThatFits) {
            tokensThatFit.push(tokenThatFits)
            currentWidth += tokenThatFits.getWidth(fontParams)
        }
        if (tokenThatOverflows) {
            unprocessedTokens.unshift(tokenThatOverflows)
            break
        }
    }
    return [tokensThatFit, unprocessedTokens]
}

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
