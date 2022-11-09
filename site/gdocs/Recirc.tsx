import React from "react"
import { EnrichedBlockRecirc } from "@ourworldindata/utils"
import { renderSpans } from "./utils"
export default function Recirc({ d }: { d: EnrichedBlockRecirc }) {
    return (
        <div className={"recirc"}>
            <div className={"recircContent"}>
                <div className={"blackCaps"}>{d.title}</div>
                <div>
                    {d.items.map(({ article, author, url }, j: number) => {
                        return (
                            <div key={j} className={"recircArticleContainer"}>
                                <div className={"recircArticle"}>
                                    <a href={url}>{article}</a>
                                </div>
                                <div className={"recircByline"}>{author}</div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
