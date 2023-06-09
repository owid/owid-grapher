import { ENDNOTES_ID, RefDictionary } from "@ourworldindata/utils"
import React from "react"
import ArticleBlock from "./ArticleBlock.js"

export default function Footnotes({
    definitions,
}: {
    definitions: RefDictionary
}) {
    if (!definitions) {
        return null
    }
    return (
        <section className="footnote-container grid grid-cols-12-full-width col-start-1 col-end-limit">
            <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                <h3 id={ENDNOTES_ID}>Endnotes</h3>
                <ol className="footnote-list">
                    {Object.values(definitions).map((ref) => {
                        return (
                            <li
                                id={`note-${ref.index + 1}`}
                                key={ref.index}
                                className="footnote-list__footnote"
                            >
                                {ref.content.map((block, i) => (
                                    <ArticleBlock key={i} b={block} />
                                ))}
                            </li>
                        )
                    })}
                </ol>
            </div>
        </section>
    )
}
