import React from "react"
import ReactDOM from "react-dom"
import { ArticleBlocks } from "./ArticleBlocks"
import Footnotes from "./Footnotes"
import {
    OwidArticleBlock,
    OwidArticleType,
} from "../../clientUtils/owidTypes.js"

export function OwidArticle(props: OwidArticleType) {
    const { content } = props

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
                <div className={"dateline"}>{content.dateline}</div>
            </div>

            {content.summary ? (
                <div>
                    <details className={"summary"} open={true}>
                        <summary>Summary</summary>
                        <ArticleBlocks blocks={content.summary} />
                    </details>
                </div>
            ) : null}

            <ArticleBlocks blocks={content.body} />

            {content.refs ? <Footnotes d={content.refs} /> : null}

            {content.citation ? (
                <div>
                    <h3>Please cite this article as:</h3>
                    <pre>
                        <code>
                            {content.citation.map((d: OwidArticleBlock) => {
                                if (d.type === "text") {
                                    return d.value
                                } else {
                                    return ""
                                    // return handleArchie(d)
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
    const props = window._OWID_ARTICLE_PROPS
    if (wrapper) {
        ReactDOM.hydrate(<OwidArticle {...props} />, wrapper)
    }
}
