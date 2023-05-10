import React, { createRef } from "react"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import {
    MarkdownTextWrap,
    parsimmonToTextTokens,
    IRToken,
} from "./MarkdownTextWrap"
import { mdParser } from "./parser.js"
import { TextWrap } from "../TextWrap/TextWrap.js"

export default {
    title: "MarkdownTextWrap",
}

@observer
class MarkdownViewer extends React.Component {
    ref = createRef<HTMLDivElement>()
    @observable width: number = 200
    @observable isLocked: boolean = false
    @observable
    markdown: string = `Hello _**world!**_

Testing this somewhat long line. **I am bold-_and-italic_. And the formatting extends into

newlines!**

These DoDs won't render on hover because there's no data for them, but they'll demonstrate the superscript on SVG:

[A dod](#dod:term1) [another dod.](#dod:term2) [The other dod](#dod:term1)

[links can contain _formatting_ too](http://ourworldindata.org). Averylongtokenthatcantbesplitbutshouldbeincludedanyway.**Canhavebold**withoutlinebreak.

_THE END_
`

    @action.bound onChangeMarkdown(
        event: React.ChangeEvent<HTMLTextAreaElement>
    ): void {
        this.markdown = event.target.value
    }

    @action.bound onMouseMove(
        event: React.MouseEvent<HTMLDivElement, MouseEvent>
    ): void {
        if (this.isLocked) return
        const elementX = event.currentTarget.offsetLeft
        const clickX = event.clientX
        this.width = clickX - elementX
    }

    @action.bound onClick(): void {
        this.isLocked = !this.isLocked
    }

    @computed get tokens(): IRToken[] {
        const result = mdParser.markdown.parse(this.markdown)
        if (result.status) {
            return parsimmonToTextTokens(result.value.children)
        }
        return []
    }

    render(): JSX.Element {
        const containerWidth =
            this.ref.current?.getBoundingClientRect().width || 1
        const svgContainerWidth = 800
        const svgMaxWidth = (this.width / containerWidth) * svgContainerWidth
        return (
            <div ref={this.ref}>
                <textarea
                    onChange={this.onChangeMarkdown}
                    style={{
                        width: "100%",
                        maxWidth: "500px",
                        display: "block",
                        height: "100px",
                        marginBottom: "30px",
                    }}
                    value={this.markdown}
                />
                <div
                    onMouseMove={this.onMouseMove}
                    onClick={this.onClick}
                    style={{
                        position: "relative",
                        minHeight: "600px",
                        fontFamily: "Arial",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            left: `${this.width}px`,
                            width: "1px",
                            height: "100%",
                            backgroundColor: "red",
                            pointerEvents: "none",
                        }}
                    ></div>
                    <pre>HTML Example</pre>
                    <div style={{ outline: "1px solid black" }}>
                        <MarkdownTextWrap
                            text={this.markdown}
                            fontSize={14}
                            maxWidth={this.width}
                        />
                    </div>
                    <pre>isSVG Example</pre>
                    <svg
                        viewBox={`0,0,${svgContainerWidth},400`}
                        style={{ outline: "1px solid black" }}
                    >
                        {new MarkdownTextWrap({
                            text: this.markdown,
                            fontSize: 14,
                            maxWidth: svgMaxWidth,
                        }).renderSVG(0, 0)}
                    </svg>
                </div>
            </div>
        )
    }
}

export const MarkdownPreview = (): JSX.Element => <MarkdownViewer />

const RED = "#f97272"
const GREEN = "#008400"

const RenderCurrentAndLegacy = ({
    text = "The quick brown fox jumped over the lazy dog.",
    fontSize = 16,
    maxWidth = 400,
    lineHeight = 1.1,
    svg = false,
}: {
    text?: string
    fontSize?: number
    maxWidth?: number
    lineHeight?: number
    svg?: boolean
}): JSX.Element => {
    const props = {
        maxWidth,
        fontSize,
        lineHeight,
        text,
    }
    const legacy = new TextWrap(props)
    const current = new MarkdownTextWrap(props)
    const width = maxWidth
    const height = Math.max(current.height, legacy.height)
    return svg ? (
        <svg width={width + 2} height={height + 2} style={{ display: "block" }}>
            {/* add offset so 1px stroke is visible */}
            <g transform="translate(1,1)">
                <rect
                    x={0}
                    y={0}
                    width={width}
                    height={legacy.height}
                    style={{
                        fill: "none",
                        stroke: RED,
                        strokeWidth: "1px",
                        strokeOpacity: 0.5,
                        strokeDasharray: "4,2",
                    }}
                />
                <rect
                    x={0}
                    y={0}
                    width={width}
                    height={current.height}
                    style={{
                        fill: "none",
                        stroke: GREEN,
                        strokeWidth: "1px",
                        strokeOpacity: 0.5,
                        strokeDasharray: "4,2",
                    }}
                />
                <g style={{ fill: RED, opacity: 0.75 }}>
                    {legacy.render(0, 0)}
                </g>
                <g style={{ fill: GREEN, opacity: 0.75 }}>
                    {current.renderSVG(0, 0)}
                </g>
            </g>
        </svg>
    ) : (
        <div>
            <div
                style={{
                    position: "absolute",
                    color: RED,
                    opacity: 0.75,
                    ...legacy.htmlStyle,
                }}
            >
                {legacy.renderHTML()}
            </div>
            <div style={{ color: GREEN, opacity: 0.75 }}>
                {current.renderHTML()}
            </div>
        </div>
    )
}

export const CompareWithTextWrap = (): JSX.Element => (
    <div>
        <h2>HTML</h2>
        <RenderCurrentAndLegacy fontSize={12.4} maxWidth={170} />
        <br />
        <RenderCurrentAndLegacy fontSize={16} maxWidth={220} />
        <br />
        <RenderCurrentAndLegacy fontSize={32} maxWidth={440} />
        <br />
        <h2>SVG</h2>
        <RenderCurrentAndLegacy fontSize={12.4} maxWidth={170} svg={true} />
        <br />
        <RenderCurrentAndLegacy fontSize={16} maxWidth={220} svg={true} />
        <br />
        <RenderCurrentAndLegacy fontSize={32} maxWidth={440} svg={true} />
        <br />
        <RenderCurrentAndLegacy
            fontSize={32}
            maxWidth={440}
            lineHeight={2}
            svg={true}
        />
    </div>
)
