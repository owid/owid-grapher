import React from "react"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import {
    IRBold,
    IRItalic,
    IRLineBreak,
    IRLink,
    IRText,
    splitIntoLines,
} from "./NewTextWrap.js"

export default {
    title: "Text wrap",
    // component: Header,
}

@observer
class MarkdownViewer extends React.Component {
    @observable width: number = 400

    @action.bound onMouseMove(
        event: React.MouseEvent<HTMLDivElement, MouseEvent>
    ): void {
        const elementX = event.currentTarget.offsetLeft
        const clickX = event.clientX
        this.width = clickX - elementX
    }

    render(): JSX.Element {
        return (
            <div
                onMouseMove={this.onMouseMove}
                style={{ position: "relative", minHeight: "600px" }}
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
                    {splitIntoLines(
                        [
                            new IRText("Hello! "),
                            new IRBold([
                                new IRText("I am bold, and this is "),
                                new IRItalic([
                                    new IRText("both bold and italic"),
                                ]),
                                new IRText(" and can even have custom "),
                                new IRLineBreak(),
                                new IRLineBreak(),
                                new IRText("newlines"),
                                new IRLineBreak(),
                                new IRLineBreak(),
                                new IRLink("http://example.com", [
                                    new IRText("and links can contain "),
                                    new IRItalic([new IRText("formatting")]),
                                    new IRText(" too. "),
                                ]),
                            ]),
                            new IRText(
                                "Averylongtokenthatcantbesplitbutshouldbeincludedanyway. "
                            ),
                            new IRBold([new IRText("Ifthereisbold")]),
                            new IRText("itwillgetalinebreak."),
                            new IRLineBreak(),
                            new IRLineBreak(),
                            new IRItalic([new IRText("THE END")]),
                        ],
                        this.width
                    ).map((tokens, i) => (
                        <div key={i}>
                            {tokens.length ? (
                                tokens.map((token) => token.toHTML())
                            ) : (
                                <br />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )
    }
}

export const Default = (): JSX.Element => <MarkdownViewer />
