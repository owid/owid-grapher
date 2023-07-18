import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    GrapherInterface,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    uniq,
    SiteFooterContext,
    MarkdownTextWrap,
    DataPageGdocContent,
    DataPageJson,
    OwidGdocInterface,
    serializeJSONForHTML,
} from "@ourworldindata/utils"
import React from "react"
import urljoin from "url-join"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_BASE_URL,
} from "../settings/clientSettings.js"
import {
    DataPageContent,
    OWID_DATAPAGE_CONTENT_ROOT_ID,
} from "./DataPageContent.js"
import { Head } from "./Head.js"
import { SiteFooter } from "./SiteFooter.js"
import { SiteHeader } from "./SiteHeader.js"
import { IFrameDetector } from "./IframeDetector.js"
import { DebugProvider } from "./gdocs/DebugContext.js"

export const DataPage = (props: {
    grapher: GrapherInterface
    variableId: number
    datapageJson: DataPageJson
    datapageGdoc?: OwidGdocInterface | null
    datapageGdocContent?: DataPageGdocContent | null
    baseUrl: string
    baseGrapherUrl: string
    isPreviewing: boolean
}) => {
    const {
        grapher,
        variableId,
        datapageJson,
        datapageGdoc,
        datapageGdocContent,
        baseGrapherUrl,
        baseUrl,
        isPreviewing,
    } = props
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
    const imageWidth = "1200"
    const imageHeight = "628"

    const variableIds = uniq(grapher.dimensions!.map((d) => d.variableId))

    const grapherConfig: GrapherProgrammaticInterface = {
        ...grapher,
        isEmbeddedInADataPage: true,
        bindUrlToWindow: true,
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
                <IFrameDetector />
                <noscript>
                    <style>{`
                    figure[data-grapher-src] { display: none !important; }
                `}</style>
                </noscript>
                {variableIds.flatMap((variableId) =>
                    [
                        getVariableDataRoute(DATA_BASE_URL, variableId),
                        getVariableMetadataRoute(DATA_BASE_URL, variableId),
                    ].map((href) => (
                        <link
                            key={href}
                            rel="preload"
                            href={href}
                            as="fetch"
                            crossOrigin="anonymous"
                        />
                    ))
                )}
            </Head>
            <body className="DataPage">
                {isPreviewing && (
                    <div className="DataPage__edit-links">
                        <a
                            href={datapageJson.googleDocEditLink}
                            target="_blank"
                            rel="noopener"
                            className="DataPage__edit-link"
                        >
                            Edit Google Doc
                        </a>
                        <a
                            href={`https://github.com/owid/owid-content/blob/master/datapages/${variableId}.json`}
                            target="_blank"
                            rel="noopener"
                            className="DataPage__edit-link"
                        >
                            Edit JSON
                        </a>
                    </div>
                )}
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <>
                        <script
                            dangerouslySetInnerHTML={{
                                __html: `window._OWID_DATAPAGE_PROPS = ${JSON.stringify(
                                    {
                                        datapageJson,
                                        datapageGdoc,
                                        datapageGdocContent,
                                    }
                                )}`,
                            }}
                        />
                        <div id={OWID_DATAPAGE_CONTENT_ROOT_ID}>
                            <DebugProvider debug={isPreviewing}>
                                <DataPageContent
                                    datapageJson={datapageJson}
                                    datapageGdoc={datapageGdoc}
                                    datapageGdocContent={datapageGdocContent}
                                    grapherConfig={grapherConfig}
                                    isPreviewing={isPreviewing}
                                />
                            </DebugProvider>
                        </div>
                    </>
                </main>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.dataPage}
                    isPreviewing={isPreviewing}
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_GRAPHER_CONFIG = ${serializeJSONForHTML(
                            grapherConfig
                        )}`,
                    }}
                />
            </body>
        </html>
    )
}
