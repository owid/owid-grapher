import React from "react"
import ReactDOM from "react-dom"

import ArticleElement from "./article-element.js"
import Footnotes from "./footnotes.js"

export function OwidArticle(props: any) {
    const { content, baseUrl, slug, createdAt, updatedAt } = props

    const coverStyle = content["cover-image"]
        ? {
              background: `url(${content["cover-image"][0].value.src})`,
              backgroundSize: "cover",
          }
        : {}

    const canonicalUrl = `${baseUrl}/${slug}`

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
                        {content.summary.reduce((memo: string, d: any) => {
                            const text: string = d.value
                            return memo + " " + text
                        }, "")}
                    </details>
                </div>
            ) : null}

            {content.body.map((d: any, i: any) => {
                return <ArticleElement key={i} d={d} />
            })}

            {content.refs ? <Footnotes d={content.refs} /> : null}

            {content.citation ? (
                <div>
                    <h3>Please cite this article as:</h3>
                    <pre>
                        <code>
                            {content.citation.map((d: any) => {
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
    console.log("props", props)
    ReactDOM.hydrate(<OwidArticle {...props} />, wrapper)
}
