import React from "react"
import { EnrichedBlockRecirc } from "@ourworldindata/utils"
import { renderSpan } from "./utils.js"
export default function Recirc({
    d,
    className = "",
}: {
    d: EnrichedBlockRecirc
    className?: string
}) {
    return (
        <div className={className}>
            <div className="recirc-content">
                <span className="recirc-content__heading overline-black-caps">
                    {renderSpan(d.title)}
                </span>
                {d.items.map(({ article, author, url }, j: number) => {
                    return (
                        <div key={j} className="recirc-article-container">
                            <h3 className="h3-bold">
                                <a href={url}>{renderSpan(article)}</a>
                            </h3>
                            <div className="body-3-medium-italic">
                                {renderSpan(author)}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
