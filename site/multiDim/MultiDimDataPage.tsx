import urljoin from "url-join"
import { Head } from "../Head.js"
import { IFrameDetector } from "../IframeDetector.js"
import { SiteHeader } from "../SiteHeader.js"
import { OWID_DATAPAGE_CONTENT_ROOT_ID } from "../DataPageV2Content.js"
import { SiteFooter } from "../SiteFooter.js"
import { SiteFooterContext, serializeJSONForHTML } from "@ourworldindata/utils"
import { MultiDimDataPageProps } from "@ourworldindata/types"
import { Html } from "../Html.js"
import { MultiDimDataPageContentProps } from "./MultiDimDataPageContent.js"

export function MultiDimDataPage({
    baseUrl,
    baseGrapherUrl,
    slug,
    configObj,
    tagToSlugMap,
    faqEntries,
    primaryTopic,
    relatedResearchCandidates,
    imageMetadata,
    isPreviewing,
}: MultiDimDataPageProps) {
    const canonicalUrl = `${baseGrapherUrl}/${slug}`
    const contentProps: MultiDimDataPageContentProps = {
        canonicalUrl,
        slug,
        configObj,
        faqEntries,
        primaryTopic,
        relatedResearchCandidates,
        imageMetadata,
        tagToSlugMap,
    }
    // Due to thumbnails not taking into account URL parameters, they are often inaccurate on
    // social media. We decided to remove them and use a single thumbnail for all charts.
    // See https://github.com/owid/owid-grapher/issues/1086
    const imageUrl: string = urljoin(baseUrl, "default-grapher-thumbnail.png")
    const imageWidth = "1200"
    const imageHeight = "628"
    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrl}
                // pageTitle={pageTitle}
                // pageDesc={pageDesc}
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
                                contentProps
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
                    isPreviewing={isPreviewing}
                />
            </body>
        </Html>
    )
}
