import React from "react"

export default function Footnotes({ d }: any) {
    if (!d || !d.length) {
        return null
    }
    return (
        <section className={"footnoteContainer"}>
            <h2>Endnotes</h2>
            <ol className={"footnotes"}>
                {d.map((footnote: string, i: number) => {
                    return (
                        <li
                            key={i}
                            id={`note-${i + 1}`}
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
