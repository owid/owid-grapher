import urljoin from "url-join"
import { StaticRouter } from "react-router-dom-v5-compat"

import { Head } from "../Head.js"
import { IFrameDetector } from "../IframeDetector.js"
import { SiteHeader } from "../SiteHeader.js"
import { OWID_DATAPAGE_CONTENT_ROOT_ID } from "../DataPageV2Content.js"
import { SiteFooter } from "../SiteFooter.js"
import {
    joinTitleFragments,
    MultiDimDataPageConfig,
    SiteFooterContext,
    serializeJSONForHTML,
} from "@ourworldindata/utils"
import { MultiDimDataPageProps } from "@ourworldindata/types"
import { DebugProvider } from "../gdocs/DebugProvider.js"
import { Html } from "../Html.js"
import {
    MultiDimDataPageContent,
    MultiDimDataPageData,
} from "./MultiDimDataPageContent.js"
import { DEFAULT_PAGE_DESCRIPTION } from "../dataPage.js"
import { JsonLdDataPage } from "../jsonLd.js"
import { makeJsonLdGrapherImageUrl } from "../jsonLdHelpers.js"
import { useMemo } from "react"

export function MultiDimDataPage({
    baseUrl,
    slug,
    configObj,
    initialViewData,
    initialViewDimensions,
    viewTitles,
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
    // Keep in sync with the client-side document.title in
    // MultiDimDataPageContent, which uses the same fragments.
    const titleFragments = joinTitleFragments(
        configObj.title.titleVariant,
        configObj.title.attributionShort
    )
    let pageTitle = configObj.title.title
    if (titleFragments) {
        pageTitle += ` - ${titleFragments}`
    }
    const pageDesc = DEFAULT_PAGE_DESCRIPTION
    const contentProps: MultiDimDataPageData = {
        canonicalUrl,
        slug,
        configObj,
        initialViewData,
        initialViewDimensions,
        faqEntries,
        primaryTopic,
        relatedResearchCandidates,
        imageMetadata,
        tagToSlugMap,
        isPreviewing,
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

    const mdimDimensions = initialViewDimensions
        ? JSON.stringify(initialViewDimensions)
        : undefined
    const mdimViewTitles =
        viewTitles && Object.keys(viewTitles).length > 0
            ? JSON.stringify(viewTitles)
            : undefined

    const headAttrs = useMemo(
        () => ({
            "data-owid-mdim-initial-view-dimensions": mdimDimensions,
            "data-owid-mdim-view-titles": mdimViewTitles,
        }),
        [mdimDimensions, mdimViewTitles]
    )

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
                attrs={headAttrs}
            >
                <meta property="og:image:width" content={imageWidth} />
                <meta property="og:image:height" content={imageHeight} />
                {!isOnArchivalPage && (
                    <JsonLdDataPage
                        baseUrl={baseUrl}
                        grapher={undefined}
                        datapageData={initialViewData}
                        canonicalUrl={canonicalUrl}
                        imageUrl={makeJsonLdGrapherImageUrl(slug ?? undefined)}
                        name={pageTitle}
                    />
                )}
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
                        <DebugProvider debug={isPreviewing}>
                            {/* Location is mandatory, but we don't really need it. */}
                            <StaticRouter location="/">
                                <MultiDimDataPageContent
                                    slug={slug}
                                    canonicalUrl={canonicalUrl}
                                    config={MultiDimDataPageConfig.fromObject(
                                        configObj
                                    )}
                                    initialViewData={initialViewData}
                                    initialViewDimensions={
                                        initialViewDimensions
                                    }
                                    isPreviewing={isPreviewing}
                                    faqEntries={faqEntries}
                                    primaryTopic={primaryTopic}
                                    relatedResearchCandidates={
                                        relatedResearchCandidates
                                    }
                                    tagToSlugMap={tagToSlugMap}
                                    imageMetadata={imageMetadata}
                                    archiveContext={archiveContext}
                                />
                            </StaticRouter>
                        </DebugProvider>
                    </div>
                </main>
                <SiteFooter
                    context={SiteFooterContext.multiDimDataPage}
                    isPreviewing={isPreviewing}
                    archiveContext={archiveContext}
                />
            </body>
        </Html>
    )
}
