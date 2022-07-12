import React, { createRef } from "react"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { MarkdownTextWrap, parsimmonToTextTokens } from "./MarkdownTextWrap.js"
import { IRToken } from "./MarkdownTextWrap.js"
import { mdParser } from "./parser.js"

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
                        viewBox={`0,0,${svgContainerWidth},200`}
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

export const Default = (): JSX.Element => <MarkdownViewer />
