import React from "react"
import { OwidArticleBlock } from "./gdoc-types.js"

export default function Footnotes({ d }: any) {
    return (
        <section className={"footnoteContainer"}>
            <h2>Endnotes</h2>
            <ol className={"footnotes"}>
                {d.map((footnote: string, i: number) => {
                    return (
                        <li
                            key={i}
                            className={"footnote"}
                            dangerouslySetInnerHTML={{
                                __html: footnote.replace(/\n+/g, "<br/><br/>"),
                            }}
                        />
                    )
                })}
            </ol>
        </section>
    )
}
