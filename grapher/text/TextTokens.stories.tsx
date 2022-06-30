import React from "react"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import { markdownToOwidTokens, mdParse } from "./markdown.js"

export default {
    title: "TextTokens",
    // component: Header,
}

@observer
class MarkdownViewer extends React.Component {
    @observable width: number = 500
    @observable
    markdown: string = `_[italic and **bold**](www.ourworldindata.org)_

also _newlines
inside italic_`

    @action.bound onChangeMarkdown(
        event: React.ChangeEvent<HTMLTextAreaElement>
    ): void {
        this.markdown = event.target.value
    }

    @action.bound onMouseMove(
        event: React.MouseEvent<HTMLDivElement, MouseEvent>
    ): void {
        const elementX = event.currentTarget.offsetLeft
        const clickX = event.clientX
        this.width = clickX - elementX
    }

    render(): JSX.Element {
        return (
            <div>
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
                    <div>
                        {markdownToOwidTokens(mdParse(this.markdown)).map(
                            (token, i) => (
                                <span
                                    key={i}
                                    style={{
                                        outline: "1px solid rgba(0,0,0,.1)",
                                    }}
                                >
                                    {token.toHTML()}
                                </span>
                            )
                        )}
                    </div>
                </div>
            </div>
        )
    }
}

export const Default = (): JSX.Element => <MarkdownViewer />
