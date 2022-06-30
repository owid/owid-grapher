import React from "react"
import { Bounds, FontFamily } from "../../clientUtils/Bounds.js"
import { imemo } from "../../coreTable/CoreTableUtils.js"
import {
    getBreakpointBefore,
    getLineWidth,
    lineToPlaintext,
    splitLineAtBreakpoint,
} from "./TextTokensUtils.js"

export interface IRFontParams {
    fontSize?: number
    fontWeight?: number
    fontFamily?: FontFamily
}

export interface IRBreakpoint {
    tokenIndex: number
    tokenStartOffset: number
    breakOffset: number
}

export interface IRToken {
    width: number
    getBreakpointBefore(targetWidth: number): IRBreakpoint | undefined
    toHTML(): JSX.Element | undefined
    toSVG(): JSX.Element | undefined
    toPlaintext(): string | undefined
}

export class IRText implements IRToken {
    constructor(public text: string, public fontParams?: IRFontParams) {}
    @imemo get width(): number {
        return Bounds.forText(this.text, this.fontParams).width
    }
    getBreakpointBefore(): undefined {
        return undefined
    }
    toHTML(): JSX.Element {
        return <React.Fragment>{this.text}</React.Fragment>
    }
    toSVG(): JSX.Element {
        return <React.Fragment>{this.text}</React.Fragment>
    }
    toPlaintext(): string {
        return this.text
    }
}

export class IRWhitespace implements IRToken {
    constructor(public fontParams?: IRFontParams) {}
    @imemo get width(): number {
        return Bounds.forText(" ", this.fontParams).width
    }
    getBreakpointBefore(): IRBreakpoint {
        // Have to give it some `breakOffset` because we designate locations
        // to split based on it, and `0` leads to being exactly in between tokens.
        return { tokenIndex: 0, tokenStartOffset: 0, breakOffset: 0.0001 }
    }
    toHTML(): JSX.Element {
        // TODO change to space
        return <React.Fragment>&nbsp;</React.Fragment>
    }
    toSVG(): JSX.Element {
        // TODO change to space
        return <React.Fragment>&nbsp;</React.Fragment>
    }
    toPlaintext(): string {
        return " "
    }
}

export class IRLineBreak implements IRToken {
    get width(): number {
        return 0
    }
    getBreakpointBefore(): undefined {
        return undefined
    }
    toHTML(): JSX.Element {
        return <br />
    }
    toSVG(): undefined {
        // We have to deal with this special case in
        // whatever procedure does text reflow.
        return undefined
    }
    toPlaintext(): string {
        return "\n"
    }
}

export abstract class IRElement implements IRToken {
    constructor(public children: IRToken[], public fontParams?: IRFontParams) {}

    @imemo get width(): number {
        return getLineWidth(this.children)
    }

    getBreakpointBefore(targetWidth: number): IRBreakpoint | undefined {
        return getBreakpointBefore(this.children, targetWidth)
    }

    splitBefore(maxWidth: number): {
        before: IRToken | undefined
        after: IRToken | undefined
    } {
        const { before, after } = splitLineAtBreakpoint(this.children, maxWidth)
        return {
            // do not create tokens without children
            before: before.length ? this.getClone(before) : undefined,
            after: after.length ? this.getClone(after) : undefined,
        }
    }

    splitOnNextLineBreak(): { before?: IRToken; after?: IRToken } {
        const index = this.children.findIndex(
            (token) => token instanceof IRLineBreak
        )
        if (index >= 0) {
            return {
                before:
                    // do not create an empty element if the first child
                    // is a newline
                    index === 0
                        ? undefined
                        : this.getClone(this.children.slice(0, index)),
                after: this.getClone(this.children.slice(index + 1)),
            }
        }
        return { before: this }
    }

    abstract getClone(children: IRToken[]): IRElement
    abstract toHTML(): JSX.Element
    abstract toSVG(): JSX.Element

    toPlaintext(): string {
        return lineToPlaintext(this.children)
    }
}

export class IRBold extends IRElement {
    getClone(children: IRToken[]): IRBold {
        return new IRBold(children, this.fontParams)
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
        return new IRItalic(children, this.fontParams)
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
    constructor(
        public href: string,
        children: IRToken[],
        fontParams?: IRFontParams
    ) {
        super(children, fontParams)
    }
    getClone(children: IRToken[]): IRLink {
        return new IRLink(this.href, children, this.fontParams)
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
