import React from "react"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { parsimmonToTextTokens } from "./markdown.js"
import { IRToken } from "./TextTokens.js"
import { splitIntoLines } from "./TextTokensUtils.js"
import { mdParser } from "./parser.js"

export default {
    title: "TextTokens",
    // component: Header,
}

@observer
class MarkdownViewer extends React.Component {
    @observable width: number = 200
    @observable isLocked: boolean = false
    @observable
    markdown: string = `Hello! **I am bold.**

Testing this somewhat long line. **I am bold-_ish_. And the bold extends into

newlines too!

[links can contain _formatting_ too](http://ourworldindata.org).**Averylongtokenthatcantbesplitbutshouldbeincludedanyway.**Canhavebold**withoutlinebreak.

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
                    <div>
                        {splitIntoLines(this.tokens, this.width).map(
                            (tokens, i) => (
                                <div key={i}>
                                    {tokens.length ? (
                                        <span
                                            style={{
                                                outline:
                                                    "1px solid rgba(0,50,50,.1)",
                                            }}
                                        >
                                            {tokens.map((token, i) =>
                                                token.toHTML(i)
                                            )}
                                        </span>
                                    ) : (
                                        <br />
                                    )}
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        )
    }
}

export const Default = (): JSX.Element => <MarkdownViewer />
