import React from "react"
import { RawBlockRecirc } from "@ourworldindata/utils"

export default function Recirc({ d }: { d: RawBlockRecirc }) {
    return (
        <div className={"recirc"}>
            <div className={"recircContent"}>
                <div className={"blackCaps"}>{d.value[0]?.title}</div>
                <div>
                    {d.value[0]?.list.map(
                        ({ article, author, url }, j: number) => {
                            return (
                                <div
                                    key={j}
                                    className={"recircArticleContainer"}
                                >
                                    <div className={"recircArticle"}>
                                        <a href={url}>{article}</a>
                                    </div>
                                    <div className={"recircByline"}>
                                        {author}
                                    </div>
                                </div>
                            )
                        }
                    )}
                </div>
            </div>
        </div>
    )
}
