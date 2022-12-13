import { EnrichedBlockText } from "@ourworldindata/utils"
import React from "react"
import Paragraph from "./Paragraph.js"

export default function Footnotes({ d }: { d: EnrichedBlockText[] }) {
    if (!d || !d.length) {
        return null
    }
    return (
        <section className="footnote-container col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
            <h3>Endnotes</h3>
            <ol className="footnote-list grid grid-cols-2">
                {d.map((footnote: EnrichedBlockText, i: number) => {
                    return (
                        <li
                            id={`note-${i + 1}`}
                            key={i}
                            className="footnote-list__footnote span-sm-cols-2"
                        >
                            <Paragraph d={footnote} />
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
