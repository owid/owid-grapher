import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    GrapherInterface,
    GRAPHER_PAGE_BODY_CLASS,
    LoadingIndicator,
} from "@ourworldindata/grapher"
import {
    flatten,
    PostReference,
    PostRow,
    RelatedChart,
    serializeJSONForHTML,
    uniq,
    SiteFooterContext,
} from "@ourworldindata/utils"
import React from "react"
import urljoin from "url-join"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import { ChartListItemVariant } from "./ChartListItemVariant.js"
import { Head } from "./Head.js"
import { IFrameDetector } from "./IframeDetector.js"
import { RelatedArticles } from "./RelatedArticles/RelatedArticles.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"

export const GrapherPage = (props: {
    grapher: GrapherInterface
    post?: PostRow
    relatedCharts?: RelatedChart[]
    relatedArticles?: PostReference[]
    baseUrl: string
    baseGrapherUrl: string
}) => {
    const { grapher, relatedCharts, relatedArticles, baseGrapherUrl, baseUrl } =
        props
    const pageTitle = grapher.title
    const pageDesc =
        grapher.subtitle ||
        "An interactive visualization from Our World in Data."
    const canonicalUrl = urljoin(baseGrapherUrl, grapher.slug as string)

    // Due to thumbnails not taking into account URL parameters, they are often inaccurate on
    // social media. We decided to remove them and use a single thumbnail for all charts.
    // See https://github.com/owid/owid-grapher/issues/1086
    //
    // const imageUrl = urljoin(
    //     baseGrapherUrl,
    //     "exports",
    //     `${grapher.slug}.png?v=${grapher.version}`
    // )
    const imageUrl: string = urljoin(baseUrl, "default-grapher-thumbnail.png")
    const imageWidth: string = "1200"
    const imageHeight: string = "628"

    const script = `const jsonConfig = ${serializeJSONForHTML({
        ...grapher,
        adminBaseUrl: ADMIN_BASE_URL,
        bakedGrapherURL: BAKED_GRAPHER_URL,
    })}
window.Grapher.renderSingleGrapherOnGrapherPage(jsonConfig)`

    const variableIds = uniq(grapher.dimensions!.map((d) => d.variableId))

    return (
        <html>
            <Head
                canonicalUrl={canonicalUrl}
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                imageUrl={imageUrl}
                baseUrl={baseUrl}
            >
                <meta property="og:image:width" content={imageWidth} />
                <meta property="og:image:height" content={imageHeight} />
                <IFrameDetector />
                <noscript>
                    <style>{`
                    figure { display: none !important; }
                `}</style>
                </noscript>
                {flatten(
                    variableIds.map((variableId) =>
                        [
                            getVariableDataRoute(variableId),
                            getVariableMetadataRoute(variableId),
                        ].map((href) => (
                            <link
                                key={href}
                                rel="preload"
                                href={href}
                                as="fetch"
                                crossOrigin="anonymous"
                            />
                        ))
                    )
                )}
            </Head>
            <body className={GRAPHER_PAGE_BODY_CLASS}>
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <figure data-grapher-src={`/grapher/${grapher.slug}`}>
                        <LoadingIndicator />
                    </figure>
                    <noscript id="fallback">
                        <img
                            src={`${baseGrapherUrl}/exports/${grapher.slug}.svg`}
                        />
                        <p>Interactive visualization requires JavaScript</p>
                    </noscript>

                    {((relatedArticles && relatedArticles.length != 0) ||
                        (relatedCharts && relatedCharts.length != 0)) && (
                        <div className="related-research-data">
                            <h2>All our related research and data</h2>
                            {relatedArticles && relatedArticles.length != 0 && (
                                <RelatedArticles articles={relatedArticles} />
                            )}
                            {relatedCharts && relatedCharts.length !== 0 && (
                                <>
                                    <h3>Charts</h3>
                                    <ul>
                                        {relatedCharts
                                            .filter(
                                                (chartItem) =>
                                                    chartItem.slug !==
                                                    grapher.slug
                                            )
                                            .map((c) => (
                                                <ChartListItemVariant
                                                    key={c.slug}
                                                    chart={c}
                                                />
                                            ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}
                </main>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.grapherPage}
                />
                <script
                    type="module"
                    dangerouslySetInnerHTML={{ __html: script }}
                />
            </body>
        </html>
    )
}
