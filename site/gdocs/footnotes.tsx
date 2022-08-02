import React from "react"

export default function Footnotes({ d, styles }: any) {
    return (
        <section className={"footnoteContainer"}>
            <h2>Endnotes</h2>
            <ol className={"footnotes"}>
                {d.map((footnote: any, i: any) => {
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
