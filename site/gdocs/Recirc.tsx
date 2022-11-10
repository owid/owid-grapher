import React from "react"
import { EnrichedBlockRecirc } from "@ourworldindata/utils"
import { renderSpan } from "./utils"
export default function Recirc({ d }: { d: EnrichedBlockRecirc }) {
    return (
        <div className={"recirc"}>
            <div className={"recircContent"}>
                <div className={"blackCaps"}>{renderSpan(d.title)}</div>
                <div>
                    {d.items.map(({ article, author, url }, j: number) => {
                        return (
                            <div key={j} className={"recircArticleContainer"}>
                                <div className={"recircArticle"}>
                                    <a href={url}>{renderSpan(article)}</a>
                                </div>
                                <div className={"recircByline"}>
                                    {renderSpan(author)}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
