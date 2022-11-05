import React from "react"
import { BlockRecirc } from "@ourworldindata/utils"

export default function Recirc({ d }: { d: BlockRecirc }) {
    return (
        <div className={"recirc"}>
            <div className={"recircContent"}>
                <div className={"blackCaps"}>{d.value[0]?.title.text}</div>
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
