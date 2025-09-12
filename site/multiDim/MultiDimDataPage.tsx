import urljoin from "url-join"
import { Head } from "../Head.js"
import { IFrameDetector } from "../IframeDetector.js"
import { SiteHeader } from "../SiteHeader.js"
import { OWID_DATAPAGE_CONTENT_ROOT_ID } from "../DataPageV2Content.js"
import { SiteFooter } from "../SiteFooter.js"
import { SiteFooterContext, serializeJSONForHTML } from "@ourworldindata/utils"
import { MultiDimDataPageProps } from "@ourworldindata/types"
import { Html } from "../Html.js"
import { MultiDimDataPageData } from "./MultiDimDataPageContent.js"
import { DEFAULT_PAGE_DESCRIPTION } from "../dataPage.js"

export function MultiDimDataPage({
    baseUrl,
    slug,
    configObj,
    tagToSlugMap,
    faqEntries,
    primaryTopic,
    relatedResearchCandidates,
    imageMetadata,
    isPreviewing,
    archiveContext,
    canonicalUrl,
}: MultiDimDataPageProps) {
    if (!slug && !isPreviewing) {
        throw new Error("Missing slug for multidimensional data page")
    }
    let pageTitle = configObj.title.title
    if (configObj.title.titleVariant) {
        pageTitle += ` - ${configObj.title.titleVariant}`
    }
    const pageDesc = DEFAULT_PAGE_DESCRIPTION
    const contentProps: MultiDimDataPageData = {
        canonicalUrl,
        slug,
        configObj,
        faqEntries,
        primaryTopic,
        relatedResearchCandidates,
        imageMetadata,
        tagToSlugMap,
        isPreviewing,
        archiveContext,
    }
    const imageUrl: string = urljoin(
        baseUrl || "/",
        "default-grapher-thumbnail.png"
    )
    const imageWidth = "1200"
    const imageHeight = "628"

    const isOnArchivalPage = archiveContext?.type === "archive-page"
    const assetMaps = isOnArchivalPage ? archiveContext.assets : undefined

    const liveUrlIfIsArchive = isOnArchivalPage
        ? archiveContext.archiveNavigation.liveUrl
        : undefined
    const canonicalUrlForHead = liveUrlIfIsArchive ?? canonicalUrl

    return (
        <Html>
            <Head
                canonicalUrl={canonicalUrlForHead}
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                imageUrl={imageUrl}
                baseUrl={baseUrl}
                staticAssetMap={assetMaps?.static}
                archiveContext={archiveContext}
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
                <SiteHeader
                    archiveInfo={isOnArchivalPage ? archiveContext : undefined}
                />
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
                    context={SiteFooterContext.multiDimDataPage}
                    isPreviewing={isPreviewing}
                    archiveInfo={isOnArchivalPage ? archiveContext : undefined}
                />
            </body>
        </Html>
    )
}
