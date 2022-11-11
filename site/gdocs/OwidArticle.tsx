import React from "react"
import ReactDOM from "react-dom"
import { ArticleBlocks } from "./ArticleBlocks"
import Footnotes from "./Footnotes"
import {
    OwidArticleType,
    formatDate,
    getArticleFromJSON,
} from "@ourworldindata/utils"
import { renderSpans } from "./utils.js"

export function OwidArticle(props: OwidArticleType) {
    const { content, publishedAt } = props

    const coverStyle = content["cover-image"]
        ? {
              background: `url(${content["cover-image"][0].value.src})`,
              backgroundSize: "cover",
          }
        : {}

    return (
        <article className="article-container grid grid-cols-12-full-width">
            <div className="article-banner" style={coverStyle}></div>
            <header className="article-header grid grid-cols-8 col-start-4 span-cols-8">
                <h1 className="article-header__title col-start-2 span-cols-6">
                    {content.title}
                </h1>
                <h2 className="article-header__subtitle col-start-2 span-cols-6">
                    {content.subtitle}
                </h2>
                <div className="article-header__byline-container col-start-2 span-cols-6">
                    By:
                    <div>{content.byline}</div>
                    <div>
                        {content.dateline ||
                            (publishedAt && formatDate(publishedAt))}
                    </div>
                </div>
            </header>

            {content.body ? <ArticleBlocks blocks={content.body} /> : null}

            {/* {content.refs ? <Footnotes d={content.refs} /> : null} */}

            {/* content.citation ? (
                <div>
                    <h3>Please cite this article as:</h3>
                    <pre>
                        <code>
                            {renderSpans(
                                content.citation.map((block) => block.value)
                            )}
                        </code>
                    </pre>
                </div>
            ) : null} */}
        </article>
    )
}

export const hydrateOwidArticle = () => {
    const wrapper = document.querySelector("#owid-article-root")
    const props = getArticleFromJSON(window._OWID_ARTICLE_PROPS)
    ReactDOM.hydrate(<OwidArticle {...props} />, wrapper)
}
