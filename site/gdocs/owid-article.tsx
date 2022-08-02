// import BaseStyles from '../styles/Home.module.css'
// import Head from 'next/head'
import React from "react"

// import CenteredArticle from '../styles/CenteredArticle.module.css';
import ArticleElement from "./article-element.js"
import Footnotes from "./footnotes.js"

import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"

const styles: any = {}

export default function OwidArticle({ content }: any) {
    //   const styles = { ...BaseStyles, ...THEMES[content.template] }

    const coverStyle = content["cover-image"]
        ? {
              background: `url(${content["cover-image"][0].value.src})`,
              backgroundSize: "cover",
          }
        : {}

    return (
        <html>
            {/* {
        content['featured-image'] ? 
        (<Head>
            <meta property="og:image" content={content['featured-image'][0].value.src} />
        </Head>) : null
        } */}
            <head>
                {/* TODO(gdocs) - add all metadata */}
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>
                    The world is awful. The world is much better. The world can
                    be much better. - Our World in Data
                </title>
                <meta
                    name="description"
                    content="It is wrong to think that these three statements contradict each other. We need to see that they are all true to see that a better world is possible."
                />
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
            </head>
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
                                {content.summary.reduce((memo: any, d: any) => {
                                    return memo + " " + (d.value as any)
                                }, "")}
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
                                    {content.citation.map((d: any, i: any) => {
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
