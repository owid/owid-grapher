// import BaseStyles from '../styles/Home.module.css'
// import Head from 'next/head'
import React from "react"
import ReactDOM from "react-dom"

import ArticleElement from "./article-element.js"
import Footnotes from "./footnotes.js"

import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidArticle } from "./owid-article.js"

const styles: any = {}
declare global {
    interface Window {
        _OWID_ARTICLE_PROPS: any
    }
}

export default function OwidArticlePage(props: any) {
    //   const styles = { ...BaseStyles, ...THEMES[content.template] }
    const { content, baseUrl, slug, createdAt, updatedAt } = props

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
                    date={updatedAt || createdAt}
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
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_ARTICLE_PROPS = ${JSON.stringify(
                            props
                        )}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader baseUrl={"https://ourworldindata.org"} />
                <div id="owid-article-root">
                    <OwidArticle {...props} />
                </div>
                <SiteFooter baseUrl={"https://ourworldindata.org"} />
            </body>
        </html>
    )
}
