import React from "react"
import { Bounds, FontFamily } from "../../clientUtils/Bounds.js"
import { sum } from "../../clientUtils/Util.js"
import { imemo } from "../../coreTable/CoreTableUtils.js"

export interface IRFontParams {
    fontSize?: number
    fontWeight?: number
    fontFamily?: FontFamily
}

export interface IRToken {
    width: number
    toHTML(): JSX.Element | undefined
    toSVG(): JSX.Element | undefined
}

export class IRText implements IRToken {
    constructor(private text: string, private fontParams?: IRFontParams) {}
    @imemo get width(): number {
        return Bounds.forText(this.text, this.fontParams).width
    }
    toHTML(): JSX.Element {
        return <React.Fragment>{this.text}</React.Fragment>
    }
    toSVG(): JSX.Element {
        return <React.Fragment>{this.text}</React.Fragment>
    }
}

export class IRWhitespace implements IRToken {
    constructor(private fontParams?: IRFontParams) {}
    get width(): number {
        return Bounds.forText(" ", this.fontParams).width
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
    get width(): number {
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
    public ownFontParams: IRFontParams = {}

    constructor(
        protected children: IRToken[],
        protected parentFontParams?: IRFontParams
    ) {}

    get fontParams(): IRFontParams {
        return {
            ...this.parentFontParams,
            ...this.ownFontParams,
        }
    }

    get width(): number {
        return sum(this.children.map((token) => token.width))
    }

    abstract getClone(children: IRToken[]): IRElement
    abstract toHTML(): JSX.Element
    abstract toSVG(): JSX.Element
}

export class IRBold extends IRElement {
    ownFontParams: IRFontParams = { fontWeight: 700 }
    getClone(children: IRToken[]): IRBold {
        return new IRBold(children, this.parentFontParams)
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
        return new IRItalic(children, this.parentFontParams)
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
        parentFontParams?: IRFontParams
    ) {
        super(children, parentFontParams)
    }
    getClone(children: IRToken[]): IRLink {
        return new IRLink(this.href, children, this.parentFontParams)
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
