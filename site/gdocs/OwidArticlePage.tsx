import React from "react"

import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidArticle } from "./OwidArticle.js"
import { OwidArticleType } from "../../clientUtils/owidTypes.js"

declare global {
    interface Window {
        _OWID_ARTICLE_PROPS: any
    }
}

export default function OwidArticlePage({
    baseUrl,
    article,
}: {
    baseUrl: string
    article: OwidArticleType
}) {
    const { content, slug, createdAt, updatedAt } = article

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
                    title={content.title || ""}
                    authors={
                        Array.isArray(content.byline)
                            ? content.byline
                            : content.byline
                            ? [content.byline]
                            : []
                    }
                    date={updatedAt || createdAt}
                    canonicalUrl={canonicalUrl}
                />

                {/* {post.style && <style>{post.style}</style>} */}
                <link
                    href="https://fonts.googleapis.com/css?family=Lato:300,400,400i,700,700i|Playfair+Display:400,700&amp;display=swap"
                    rel="stylesheet"
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_ARTICLE_PROPS = ${JSON.stringify(
                            article
                        )}`,
                    }}
                ></script>
            </Head>
            <body>
                <SiteHeader baseUrl={baseUrl} />
                <div id="owid-article-root">
                    <OwidArticle {...article} />
                </div>
                <SiteFooter baseUrl={baseUrl} />
            </body>
        </html>
    )
}
