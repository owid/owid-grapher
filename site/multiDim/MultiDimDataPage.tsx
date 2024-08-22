import React from "react"
import { Head } from "../Head.js"
import { IFrameDetector } from "../IframeDetector.js"
import { SiteHeader } from "../SiteHeader.js"
import { OWID_DATAPAGE_CONTENT_ROOT_ID } from "../DataPageV2Content.js"
import { SiteFooter } from "../SiteFooter.js"
import { SiteFooterContext, serializeJSONForHTML } from "@ourworldindata/utils"
import { MultiDimDataPageProps } from "@ourworldindata/types"
import { Html } from "../Html.js"

export const MultiDimDataPage = (props: {
    baseUrl: string
    multiDimProps: MultiDimDataPageProps
}) => {
    const { multiDimProps } = props

    const canonicalUrl = "" // TODO
    const baseUrl = props.baseUrl // TODO

    return (
        <Html>
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
                <link
                    rel="preload"
                    href="/fonts/PlayfairDisplayLatin-SemiBold.woff2"
                    as="font"
                    type="font/woff2"
                    crossOrigin="anonymous"
                />
            </Head>
            <body className="DataPage MultiDimDataPage">
                <SiteHeader baseUrl={baseUrl} />
                <main>
                    <script
                        dangerouslySetInnerHTML={{
                            __html: `window._OWID_MULTI_DIM_PROPS = ${serializeJSONForHTML(
                                multiDimProps
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
            </body>
        </Html>
    )
}
