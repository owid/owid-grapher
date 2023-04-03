import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    GrapherInterface,
} from "@ourworldindata/grapher"
import {
    flatten,
    uniq,
    SiteFooterContext,
    MarkdownTextWrap,
} from "@ourworldindata/utils"
import React from "react"
import urljoin from "url-join"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.js"
import {
    DataPageContent,
    OWID_DATAPAGE_CONTENT_ROOT_ID,
} from "./DataPageContent.js"
import { Head } from "./Head.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"

export const DataPage = (props: {
    grapher: GrapherInterface
    datapage?: any
    baseUrl: string
    baseGrapherUrl: string
}) => {
    const { grapher, datapage, baseGrapherUrl, baseUrl } = props
    const pageTitle = grapher.title
    const canonicalUrl = urljoin(baseGrapherUrl, grapher.slug as string)
    let pageDesc: string
    if (grapher.subtitle?.length) {
        // convert subtitle from markdown to plaintext
        pageDesc = new MarkdownTextWrap({
            text: grapher.subtitle,
            fontSize: 10,
        }).plaintext
    } else pageDesc = "An interactive visualization from Our World in Data."

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

    const variableIds = uniq(grapher.dimensions!.map((d) => d.variableId))

    const grapherConfig = {
        ...grapher,
        isEmbeddedInADataPage: true,
        bakedGrapherURL: BAKED_GRAPHER_URL,
        adminBaseUrl: ADMIN_BASE_URL,
    }

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
                <noscript>
                    <style>{`
                    figure[data-grapher-src] { display: none !important; }
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
            <body className="DataPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <>
                        <script
                            dangerouslySetInnerHTML={{
                                __html: `window._OWID_DATAPAGE_PROPS = ${JSON.stringify(
                                    {
                                        datapage,
                                        grapherConfig,
                                    }
                                )}`,
                            }}
                        />
                        <div id={OWID_DATAPAGE_CONTENT_ROOT_ID}>
                            <DataPageContent
                                datapage={datapage}
                                grapherConfig={grapherConfig}
                            />
                        </div>
                    </>
                </main>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.dataPage}
                />
            </body>
        </html>
    )
}
