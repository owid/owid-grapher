import React from "react"

import { Head } from "../Head.js"
import { SiteHeader } from "../SiteHeader.js"
import { SiteFooter } from "../SiteFooter.js"
import { CitationMeta } from "../CitationMeta.js"
import { OwidArticle } from "./OwidArticle.js"
import { get } from "lodash"

import { OwidArticleType, SiteFooterContext } from "@ourworldindata/utils"
import { DebugProvider } from "./DebugContext.js"

declare global {
    interface Window {
        _OWID_ARTICLE_PROPS: any
    }
}

export default function OwidArticlePage({
    baseUrl,
    article,
    debug,
    isPreviewing = false,
}: {
    baseUrl: string
    article: OwidArticleType
    debug?: boolean
    isPreviewing?: boolean
}) {
    const { content, slug, createdAt, updatedAt } = article

    const canonicalUrl = `${baseUrl}/${slug}`

    return (
        <html>
            <Head
                pageTitle={content.title}
                pageDesc={content.subtitle}
                canonicalUrl={canonicalUrl}
                imageUrl={get(
                    content,
                    ["featured-image", 0, "value", "src"],
                    ""
                )}
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
                    <DebugProvider debug={debug}>
                        <OwidArticle {...article} isPreviewing={isPreviewing} />
                    </DebugProvider>
                </div>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.gdocsArticle}
                    debug={debug}
                    isPreviewing={isPreviewing}
                />
            </body>
        </html>
    )
}
