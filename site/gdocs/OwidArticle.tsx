import React from "react"
import ReactDOM from "react-dom"
import { ArticleBlocks } from "./ArticleBlocks"
import Footnotes from "./Footnotes"
import {
    OwidArticleBlock,
    OwidArticleType,
    formatDate,
    getArticleFromJSON,
} from "@ourworldindata/utils"

export function OwidArticle(props: OwidArticleType) {
    const { content, publishedAt } = props

    const coverStyle = content["cover-image"]
        ? {
              background: `url(${content["cover-image"][0].value.src})`,
              backgroundSize: "cover",
          }
        : {}

    return (
        <article className={"owidArticle"}>
            <div className={"articleCover"} style={coverStyle}></div>
            <div className={"articlePage"}></div>
            <h1 className={"title"}>{content.title}</h1>
            <h2 className={"subtitle"}>{content.subtitle}</h2>
            <div className={"bylineContainer"}>
                <div>
                    By: <div className={"byline"}>{content.byline}</div>
                </div>
                <div className={"dateline"}>
                    {content.dateline ||
                        (publishedAt && formatDate(publishedAt))}
                </div>
            </div>

            {content.summary ? (
                <div>
                    <details className={"summary"} open={true}>
                        <summary>Summary</summary>
                        <ArticleBlocks blocks={content.summary} />
                    </details>
                </div>
            ) : null}

            {content.body ? <ArticleBlocks blocks={content.body} /> : null}

            {content.refs ? <Footnotes d={content.refs} /> : null}

            {content.citation &&
            content.citation.some(
                (d: OwidArticleBlock) => d.type === "text"
            ) ? (
                <div>
                    <h3>Please cite this article as:</h3>
                    <pre>
                        <code>
                            {content.citation.map((d: OwidArticleBlock) => {
                                if (d.type === "text") {
                                    return d.value
                                } else {
                                    return ""
                                }
                            })}
                        </code>
                    </pre>
                </div>
            ) : null}
        </article>
    )
}

export const hydrateOwidArticle = () => {
    const wrapper = document.querySelector("#owid-article-root")
    const props = getArticleFromJSON(window._OWID_ARTICLE_PROPS)
    ReactDOM.hydrate(<OwidArticle {...props} />, wrapper)
}
