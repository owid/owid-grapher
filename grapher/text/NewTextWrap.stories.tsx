import React from "react"
import { action, observable } from "mobx"
import { observer } from "mobx-react"
import {
    IRBold,
    IRItalic,
    IRLineBreak,
    IRLink,
    IRText,
    IRWhitespace,
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
                    {splitIntoLines(
                        [
                            new IRText("I"),
                            new IRWhitespace(),
                            new IRText("am"),
                            new IRWhitespace(),
                            new IRText("bold"),
                            new IRText("."),
                            new IRWhitespace(),
                            new IRText("and"),
                            new IRWhitespace(),
                            new IRText("that"),
                            new IRText("'s"),
                            new IRWhitespace(),
                            new IRText("fine."),
                            new IRWhitespace(),
                            new IRLineBreak(),
                            new IRLineBreak(),
                            new IRLineBreak(),
                            new IRText("Hello!"),
                            new IRWhitespace(),
                            new IRText("Testing"),
                            new IRWhitespace(),
                            new IRText("this"),
                            new IRWhitespace(),
                            new IRText("somewhat"),
                            new IRWhitespace(),
                            new IRText("long"),
                            new IRWhitespace(),
                            new IRText("line"),
                            new IRText("."),
                            new IRWhitespace(),
                            new IRBold([
                                new IRText("I"),
                                new IRWhitespace(),
                                new IRText("am"),
                                new IRWhitespace(),
                                new IRText("bold"),
                                new IRItalic([new IRText("-ish")]),
                                new IRText("."),
                                new IRWhitespace(),
                                new IRText("and"),
                                new IRWhitespace(),
                                new IRText("that"),
                                new IRText("'s"),
                                new IRWhitespace(),
                                new IRText("fine."),
                                new IRLineBreak(),
                                new IRLineBreak(),
                                new IRText("newlines"),
                                new IRLineBreak(),
                                new IRLineBreak(),
                                new IRLink("http://example.com", [
                                    new IRText("links"),
                                    new IRWhitespace(),
                                    new IRText("can"),
                                    new IRWhitespace(),
                                    new IRText("contain"),
                                    new IRWhitespace(),
                                    new IRItalic([new IRText("formatting")]),
                                    new IRWhitespace(),
                                    new IRText("too."),
                                ]),
                            ]),
                            new IRText(
                                "Averylongtokenthatcantbesplitbutshouldbeincludedanyway."
                            ),
                            new IRBold([new IRText("Ifthereisbold")]),
                            new IRText("itwillgetalinebreak."),
                            new IRLineBreak(),
                            new IRLineBreak(),
                            new IRItalic([
                                new IRText("THE"),
                                new IRWhitespace(),
                                new IRText("END"),
                            ]),
                        ],
                        this.width
                    ).map((tokens, i) => (
                        <div key={i}>
                            {tokens.length ? (
                                <span style={{ border: "1px solid #ddd" }}>
                                    {tokens.map((token) => token.toHTML())}
                                </span>
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
