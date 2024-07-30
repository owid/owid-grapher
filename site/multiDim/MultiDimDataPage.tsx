import React from "react"
import { MultiDimDataPageConfig } from "./MultiDimDataPageConfig.js"
import { Head } from "../Head.js"
import { IFrameDetector } from "../IframeDetector.js"
import { SiteHeader } from "../SiteHeader.js"
import { OWID_DATAPAGE_CONTENT_ROOT_ID } from "../DataPageV2Content.js"
import { SiteFooter } from "../SiteFooter.js"
import {
    SiteFooterContext,
    pick,
    serializeJSONForHTML,
} from "@ourworldindata/utils"

export const MultiDimDataPage = (props: {
    baseUrl: string
    config: MultiDimDataPageConfig
    tagToSlugMap?: Record<string, string>
}) => {
    const { config } = props

    const canonicalUrl = "" // TODO
    const baseUrl = props.baseUrl // TODO

    // Only embed the tags that are actually used by the datapage, instead of the complete JSON object with ~240 properties
    const minimalTagToSlugMap = pick(
        props.tagToSlugMap,
        config.config.topicTags ?? []
    )

    return (
        <html>
            <Head
                canonicalUrl={canonicalUrl}
                // pageTitle={pageTitle}
                // pageDesc={pageDesc}
                // imageUrl={imageUrl}
                baseUrl={baseUrl}
            >
                {/* <meta property="og:image:width" content={imageWidth} />
                <meta property="og:image:height" content={imageHeight} /> */}
                <IFrameDetector />
                <noscript>
                    <style>{`
                    figure[data-grapher-src] { display: none !important; }
                `}</style>
                </noscript>
                {/* <link rel="preconnect" href={dataApiOrigin} />
                {variableIds.flatMap((variableId) =>
                    [
                        getVariableDataRoute(DATA_API_URL, variableId),
                        getVariableMetadataRoute(DATA_API_URL, variableId),
                    ].map((href) => (
                        <link
                            key={href}
                            rel="preload"
                            href={href}
                            as="fetch"
                            crossOrigin="anonymous"
                        />
                    ))
                )} */}
                <link
                    rel="preload"
                    href="/fonts/PlayfairDisplayLatin-SemiBold.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className="DataPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `window._OWID_DATAPAGEV2_PROPS = ${JSON.stringify(
                                {
                                    // datapageData,
                                    // faqEntries,
                                    canonicalUrl,
                                    tagToSlugMap: minimalTagToSlugMap,
                                    // imageMetadata,
                                }
                            )}`,
                        }}
                    />
                    <div id={OWID_DATAPAGE_CONTENT_ROOT_ID}>
                        {/* <DebugProvider debug={isPreviewing}>
                            <DataPageV2Content
                                datapageData={datapageData}
                                grapherConfig={grapherConfig}
                                imageMetadata={imageMetadata}
                                isPreviewing={isPreviewing}
                                faqEntries={faqEntries}
                                canonicalUrl={canonicalUrl}
                                tagToSlugMap={tagToSlugMap}
                            />
                        </DebugProvider> */}
                    </div>
                </main>
                <SiteFooter
                    baseUrl={baseUrl}
                    context={SiteFooterContext.multiDimDataPage}
                    // isPreviewing={isPreviewing}
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `window._OWID_MULTI_DIM_CONFIG = ${serializeJSONForHTML(
                            props.config.config
                        )}`,
                    }}
                />
            </body>
        </html>
    )
}
