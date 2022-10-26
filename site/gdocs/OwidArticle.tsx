import React from "react"
import ReactDOM from "react-dom"
import { ArticleBlocks } from "./ArticleBlocks"
import Footnotes from "./Footnotes"
import {
    OwidArticleBlock,
    OwidArticleProps,
} from "../../clientUtils/owidTypes.js"
import { formatDate, getArticleFromJSON } from "../../clientUtils/Util.js"

export function OwidArticle(props: OwidArticleProps) {
    const { content, publishedAt } = props.article
    let element: JSX.Element

    try {
        const coverStyle = content["cover-image"]
            ? {
                  background: `url(${content["cover-image"][0].value.src})`,
                  backgroundSize: "cover",
              }
            : {}

        element = (
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
    } catch (e) {
        if (props.isPreviewing)
            element = (
                <div>
                    There was an error rendering this article. Please check the
                    console for more details.
                </div>
            )
        else throw e
    }
    return element
}

export const hydrateOwidArticle = () => {
    const wrapper = document.querySelector("#owid-article-root")
    const props = getArticleFromJSON(window._OWID_ARTICLE_PROPS)
    // TODO: how should isPreviewing supposed to be set in the hydration case?
    ReactDOM.hydrate(
        <OwidArticle article={props} isPreviewing={false} />,
        wrapper
    )
}
