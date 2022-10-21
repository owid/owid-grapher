import React from "react"
import { OwidArticleBlock } from "../../clientUtils/owidTypes.js"

export default function Recirc({ d }: { d: OwidArticleBlock }) {
    return (
        <div className={"recirc"}>
            <div className={"recircContent"}>
                <div className={"blackCaps"}>{d?.value[0]?.title}</div>
                <div>
                    {d?.value[0]?.list.map(
                        (
                            {
                                article,
                                author,
                                url,
                            }: { article: string; author: string; url: string },
                            j: number
                        ) => {
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
