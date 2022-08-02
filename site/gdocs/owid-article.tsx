// import BaseStyles from '../styles/Home.module.css'
// import Head from 'next/head'
import React from "react"

import ArticleElement from "./article-element.js"
import Footnotes from "./footnotes.js"

import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"

const styles: any = {}

export default function OwidArticle({
    content,
    baseUrl,
    slug,
    created_at,
    updated_at,
}: any) {
    //   const styles = { ...BaseStyles, ...THEMES[content.template] }

    const coverStyle = content["cover-image"]
        ? {
              background: `url(${content["cover-image"][0].value.src})`,
              backgroundSize: "cover",
          }
        : {}

    const canonicalUrl = `${baseUrl}/${slug}`

    return (
        <html>
            <Head
                pageTitle={content.title}
                pageDesc={content.subtitle}
                canonicalUrl={canonicalUrl}
                imageUrl={
                    content["featured-image"]
                        ? content["featured-image"][0].value.src
                        : ""
                }
                baseUrl={baseUrl}
            >
                <CitationMeta
                    title={content.title}
                    authors={
                        Array.isArray(content.byline)
                            ? content.byline
                            : [content.byline]
                    }
                    date={updated_at || created_at}
                    canonicalUrl={canonicalUrl}
                />

                {/* {post.style && <style>{post.style}</style>} */}
                <link
                    href="https://fonts.googleapis.com/css?family=Lato:300,400,400i,700,700i|Playfair+Display:400,700&amp;display=swap"
                    rel="stylesheet"
                />
                {/* TODO(gdocs) - replace with correct URLs */}
                <link
                    rel="stylesheet"
                    href="http://localhost:8090/commons.css"
                ></link>
                <link
                    rel="stylesheet"
                    href="http://localhost:8090/owid.css"
                ></link>
            </Head>
            <body>
                <SiteHeader baseUrl={"https://ourworldindata.org"} />
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
                                {content.summary.reduce(
                                    (memo: string, d: any) => {
                                        const text: string = d.value
                                        return memo + " " + text
                                    },
                                    ""
                                )}
                            </details>
                        </div>
                    ) : null}

                    {content.body.map((d: any, i: any) => {
                        return <ArticleElement key={i} d={d} styles={styles} />
                    })}

                    {content.refs ? (
                        <Footnotes d={content.refs} styles={styles} />
                    ) : null}

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
                <SiteFooter baseUrl={"https://ourworldindata.org"} />
            </body>
        </html>
    )
}
