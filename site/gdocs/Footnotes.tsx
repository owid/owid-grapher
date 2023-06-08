import { EnrichedBlockText, ENDNOTES_ID } from "@ourworldindata/utils"
import React from "react"
import Paragraph from "./Paragraph.js"

export default function Footnotes({ d }: { d: EnrichedBlockText[] }) {
    if (!d || !d.length) {
        return null
    }
    return (
        <section className="footnote-container grid grid-cols-12-full-width col-start-1 col-end-limit">
            <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                <h3 id={ENDNOTES_ID}>Endnotes</h3>
                <ol className="footnote-list">
                    {d.map((footnote: EnrichedBlockText, i: number) => {
                        return (
                            <li
                                id={`note-${i + 1}`}
                                key={i}
                                className="footnote-list__footnote"
                            >
                                <Paragraph d={footnote} />
                            </li>
                        )
                    })}
                </ol>
            </div>
        </section>
    )
}
