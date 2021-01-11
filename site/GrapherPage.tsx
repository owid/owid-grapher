import * as React from "react"
import urljoin from "url-join"
import { GrapherInterface } from "../grapher/core/GrapherInterface"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { Head } from "./Head"
import { PostReference, PostRow, RelatedChart } from "../clientUtils/owidTypes"
import { ChartListItemVariant } from "./ChartListItemVariant"
import { LoadingIndicator } from "../grapher/loadingIndicator/LoadingIndicator"
import { IFrameDetector } from "./IframeDetector"
import { serializeJSONForHTML } from "../clientUtils/serializers"
import { GRAPHER_PAGE_BODY_CLASS } from "../grapher/core/GrapherConstants"
import { uniq } from "../clientUtils/Util"
import { RelatedArticles } from "./RelatedArticles/RelatedArticles"

export const GrapherPage = (props: {
    grapher: GrapherInterface
    post?: PostRow
    relatedCharts?: RelatedChart[]
    relatedArticles?: PostReference[]
    baseUrl: string
    baseGrapherUrl: string
}) => {
    const {
        grapher,
        relatedCharts,
        relatedArticles,
        baseGrapherUrl,
        baseUrl,
    } = props
    const pageTitle = grapher.title
    const pageDesc =
        grapher.subtitle ||
        "An interactive visualization from Our World in Data."
    const canonicalUrl = urljoin(baseGrapherUrl, grapher.slug as string)
    const imageUrl = urljoin(
        baseGrapherUrl,
        "exports",
        `${grapher.slug}.png?v=${grapher.version}`
    )

    const script = `const jsonConfig = ${serializeJSONForHTML(grapher)}
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
                <meta property="og:image:width" content="850" />
                <meta property="og:image:height" content="600" />
                <IFrameDetector />
                <noscript>
                    <style>{`
                    figure { display: none !important; }
                `}</style>
                </noscript>
                <link
                    rel="preload"
                    href={`/grapher/data/variables/${variableIds.join(
                        "+"
                    )}.json?v=${grapher.version}`}
                    as="fetch"
                    crossOrigin="anonymous"
                />
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
                <SiteFooter baseUrl={baseUrl} />
                <script dangerouslySetInnerHTML={{ __html: script }} />
            </body>
        </html>
    )
}
