import { EnrichedBlockText } from "@ourworldindata/utils"
import React from "react"
import Paragraph from "./Paragraph.js"

export default function Footnotes({ d }: { d: EnrichedBlockText[] }) {
    if (!d || !d.length) {
        return null
    }
    return (
        <section className={"footnoteContainer"}>
            <h2>Endnotes</h2>
            <ol className={"footnotes"}>
                {d.map((footnote: EnrichedBlockText, i: number) => {
                    return (
                        <li id={`note-${i + 1}`} key={i} className={"footnote"}>
                            <Paragraph d={footnote} />
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
