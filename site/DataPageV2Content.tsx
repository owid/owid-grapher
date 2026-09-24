import { useMemo, useEffect, useState, useRef, useCallback } from "react"
import cx from "clsx"
import { runInAction, reaction, when } from "mobx"
import {
    GrapherProgrammaticInterface,
    GuidedChartContext,
    GrapherState,
} from "@ourworldindata/grapher"
import { DATAPAGE_ABOUT_THIS_DATA_SECTION_ID } from "@ourworldindata/components"
import {
    EXPERIMENT_ARM_SEPARATOR,
    EXPERIMENT_PREFIX,
    DataPageV2ContentFields,
    GrapherInterface,
    ImageMetadata,
    defaultExperimentState,
    getExperimentState,
    ExperimentState,
    isDataPageMetadataRedesignActive,
    Url,
} from "@ourworldindata/utils"
import { RelatedCharts } from "./blocks/RelatedCharts.js"
import { FeaturedMetrics } from "./FeaturedMetrics.js"
import { RelatedDataCharts } from "./RelatedDataCharts.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
} from "../settings/clientSettings.mjs"
import DownloadSection, {
    type DownloadSectionProps,
} from "./DownloadSection.js"
import { processRelatedResearch } from "./dataPage.js"
import { GrapherWithFallback } from "./GrapherWithFallback.js"
import { AttachmentsContext } from "./gdocs/AttachmentsContext.js"
import { DocumentContext } from "./gdocs/DocumentContext.js"
import { useWindowQueryParams } from "./hooks.js"
import IndicatorMetadataBox from "./IndicatorMetadataBox.js"
import AboutThisData from "./AboutThisData.js"
import DataPageResearchAndWriting from "./DataPageResearchAndWriting.js"
import MetadataSection from "./MetadataSection.js"
import { DataPerspectives } from "./DataPerspectives.js"
import {
    parseDataPerspectivesVariant,
    resolveVariantSearch,
    thumbQueryString,
} from "./dataPerspectivesVariant.js"
import { DataPerspectivesAccordion } from "./DataPerspectivesAccordion.js"
import { DataPerspectivesExplorer } from "./DataPerspectivesExplorer.js"
import { DataPerspectivesDrawer } from "./DataPerspectivesDrawer.js"
import {
    getDataPerspectives,
    RELATED_DATA_PAGES,
    RELATED_CHARTS_FALLBACK,
} from "./dataPerspectivesFixtures.js"
import { SiteQueryClientProvider } from "./SiteQueryClientProvider.js"

declare global {
    interface Window {
        _OWID_DATAPAGEV2_PROPS: DataPageV2ContentFields
        _OWID_GRAPHER_CONFIG: GrapherInterface
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

type DataPageDownloadSectionProps = Pick<
    DownloadSectionProps,
    "archivedChartInfo" | "baseUrl" | "distribution" | "slug"
>

function DataPageDownloadSection({
    archivedChartInfo,
    baseUrl,
    distribution,
    slug,
}: DataPageDownloadSectionProps) {
    const reactiveQueryStr = useWindowQueryParams()
    const searchParams = new URLSearchParams(reactiveQueryStr)

    return (
        <DownloadSection
            slug={slug}
            baseUrl={baseUrl}
            searchParams={searchParams}
            distribution={distribution}
            archivedChartInfo={archivedChartInfo}
        />
    )
}

export const DataPageV2Content = ({
    datapageData,
    grapherConfig,
    isPreviewing = false,
    faqEntries,
    canonicalUrl = "{URL}", // when we bake pages to their proper url this will be set correctly but on preview pages we leave this undefined
    imageMetadata,
    archiveContext,
    distribution,
}: DataPageV2ContentFields & {
    grapherConfig: GrapherInterface
    imageMetadata: Record<string, ImageMetadata>
}) => {
    const slug = grapherConfig.slug
    const useNewDatapageDesign = isDataPageMetadataRedesignActive(
        `/grapher/${slug}`
    )
    const queryStr =
        typeof window !== "undefined" ? window?.location?.search : undefined

    // Initialize the grapher for client-side rendering
    const mergedGrapherConfig: GrapherProgrammaticInterface = useMemo(
        () => ({
            ...grapherConfig,
            bindUrlToWindow: typeof window !== "undefined",
            adminBaseUrl: ADMIN_BASE_URL,
            bakedGrapherURL: BAKED_GRAPHER_URL,
            enableKeyboardShortcuts: typeof window !== "undefined",
            archiveContext,
            useNewDatapageMetadataLayout: useNewDatapageDesign,
        }),
        [grapherConfig, archiveContext, useNewDatapageDesign]
    )

    // --- Data perspectives prototype -------------------------------------
    // The array of alternative views rendered next to the grapher. Clicking one
    // drives the live chart in place, reusing the GuidedChart machinery that
    // already does exactly this for guided charts in articles.
    const perspectives = getDataPerspectives(slug)
    // The page's related charts — or, when the local dev database has no coview
    // data (it never does), the live site's list for the prototype pages.
    const relatedCharts =
        datapageData.relatedChartsByCoview &&
        datapageData.relatedChartsByCoview.length > 0
            ? datapageData.relatedChartsByCoview
            : ((slug && RELATED_CHARTS_FALLBACK[slug]) ?? [])
    const [ignoredParamsDismissed, setIgnoredParamsDismissed] = useState(false)
    // Parsed after mount, not during render: the server has no window.location,
    // and React does not patch up attribute mismatches during hydration — so a
    // variant computed inline would leave the wrapper stuck on the SSR default.
    const [perspectivesVariant, setPerspectivesVariant] = useState(() =>
        parseDataPerspectivesVariant(undefined)
    )
    useEffect(() => {
        setPerspectivesVariant(
            parseDataPerspectivesVariant(resolveVariantSearch())
        )
    }, [])
    const grapherStateRef = useRef<GrapherState | null>(null)
    const chartRef = useRef<HTMLDivElement | null>(null)

    const isExplorer = perspectivesVariant.layout === "explorer"

    const handlePerspectiveSelect = useCallback((href: string) => {
        const grapherState = grapherStateRef.current
        if (!grapherState) return
        const url = Url.fromURL(href)
        runInAction(() => {
            grapherState.clearQueryParams()
            grapherState.populateFromQueryParams(url.queryParams)
        })
    }, [])

    // Applies perspective `index` to the live chart.
    //
    // In the narrative style the perspective's title becomes the chart's own
    // title. Perspectives are treated as title-only here: the chart keeps its
    // real subtitle, with the indicator's real title moved to the front of it
    // in bold — so what the data *is* stays visible, just demoted.
    const isNarrative =
        perspectivesVariant.layout === "pageswipe" &&
        perspectivesVariant.style === "narrative"
    // What the chart *displays* before we touch it. Captured once, from the
    // grapher itself rather than the saved config: a chart with no saved
    // subtitle (life-expectancy) shows one derived from its indicator, and
    // building from the config would drop it. The raw values are kept too, so
    // reverting restores exactly the original behaviour.
    const originalHeader = useRef<{
        displayTitle: string
        displaySubtitle: string
        rawTitle: string | undefined
        rawSubtitle: string | undefined
    } | null>(null)

    // Once the reader changes the view (adds a country, moves the timeline,
    // switches tab), the narrative title no longer describes what's on screen.
    const [narrativeStale, setNarrativeStale] = useState(false)
    const appliedParamsRef = useRef<string | null>(null)
    const lastAppliedIndexRef = useRef(0)

    const applyPerspective = useCallback(
        (index: number) => {
            const grapherState = grapherStateRef.current
            const perspective = perspectives[index]
            if (!grapherState || !perspective) return
            const url = Url.fromURL(
                `/grapher/${slug}?${perspective.queryParams}`
            )
            lastAppliedIndexRef.current = index
            runInAction(() => {
                grapherState.clearQueryParams()
                grapherState.populateFromQueryParams(url.queryParams)
                if (isNarrative) {
                    // The header has to wait for the chart's data columns: a
                    // chart with no saved subtitle derives one from its
                    // indicator's description, which only exists once the
                    // data has loaded. Capturing earlier gives an empty
                    // subtitle (what happened on life-expectancy).
                    const setHeader = () =>
                        runInAction(() => {
                            if (!originalHeader.current) {
                                originalHeader.current = {
                                    displayTitle: grapherState.mainTitle ?? "",
                                    displaySubtitle:
                                        grapherState.effectiveSubtitle ?? "",
                                    rawTitle: grapherState.title,
                                    rawSubtitle: grapherState.subtitle,
                                }
                            }
                            const original = originalHeader.current
                            if (perspective.title) {
                                // The original title leads the subtitle, in
                                // bold, followed by the whole original subtitle.
                                const leadIn = original.displayTitle.replace(
                                    /\.$/,
                                    ""
                                )
                                grapherState.title = perspective.title
                                grapherState.subtitle =
                                    `**${leadIn}.** ${original.displaySubtitle}`.trim()
                            } else {
                                grapherState.title = original.rawTitle
                                grapherState.subtitle = original.rawSubtitle
                            }
                        })
                    const columnsLoaded = () =>
                        grapherState.isReady &&
                        grapherState.yColumnsFromDimensions.length > 0
                    if (originalHeader.current || columnsLoaded()) setHeader()
                    else void when(columnsLoaded, setHeader)
                }
                // Snapshot inside the action, so the change watcher (which
                // runs as the action ends) compares against *this* view.
                appliedParamsRef.current = JSON.stringify(
                    grapherState.changedParams
                )
            })
            setNarrativeStale(false)
        },
        [perspectives, slug, isNarrative]
    )

    const restoreNarrative = useCallback(
        () => applyPerspective(lastAppliedIndexRef.current),
        [applyPerspective]
    )

    // Watch the chart's state; the first change away from the applied
    // perspective marks the narrative stale. In "hide" mode the chart then
    // reverts to its own title; in "disable" mode the title stays (struck
    // through by CSS) and the reader gets a way back.
    useEffect(() => {
        if (!isNarrative) return
        let dispose: (() => void) | undefined
        const id = window.setInterval(() => {
            const grapherState = grapherStateRef.current
            if (!grapherState?.isConfigReady) return
            window.clearInterval(id)
            dispose = reaction(
                () => JSON.stringify(grapherState.changedParams),
                (params) => {
                    if (appliedParamsRef.current === null) return
                    if (params === appliedParamsRef.current) return
                    setNarrativeStale(true)
                    // Nothing to change in the chart itself: the title is
                    // blanked (hide) or struck through (disable) by CSS, so its
                    // space and the subtitle beneath it stay exactly as they
                    // were.
                }
            )
        }, 100)
        return () => {
            window.clearInterval(id)
            dispose?.()
        }
    }, [isNarrative, perspectivesVariant.narrativeStale])

    // In the one-at-a-time layouts the first perspective is shown as the
    // current one ("1/5"), so it has to be what the chart actually shows —
    // otherwise the label describes one view while the chart shows the
    // default. Wait for grapher's config to land, then apply it, so our
    // params aren't overwritten by its own initial load.
    const appliedInitialPerspective = useRef(false)
    useEffect(() => {
        const layout = perspectivesVariant.layout
        const oneAtATime =
            layout === "swipe" ||
            layout === "pageswipe" ||
            layout === "explorer"
        if (!oneAtATime || !perspectives.length) return
        if (appliedInitialPerspective.current) return
        let tries = 0
        const id = window.setInterval(() => {
            const grapherState = grapherStateRef.current
            if (grapherState?.isConfigReady) {
                window.clearInterval(id)
                appliedInitialPerspective.current = true
                applyPerspective(0)
            } else if (++tries > 150) {
                window.clearInterval(id)
            }
        }, 100)
        return () => window.clearInterval(id)
    }, [perspectivesVariant.layout, perspectives.length, applyPerspective])

    const handlePerspectiveReset = useCallback(() => {
        const grapherState = grapherStateRef.current
        if (!grapherState) return
        // clearQueryParams is grapher's own "reset to original".
        runInAction(() => grapherState.clearQueryParams())
    }, [])

    const relatedResearch = processRelatedResearch(
        datapageData.relatedResearch,
        datapageData.topicTagsLinks ?? []
    )

    // note: experimentState should NOT be used to conditionally render content b/c
    // it will cause a flash of content before js loads.
    const [experimentState, setExperimentState] = useState<ExperimentState>(
        defaultExperimentState
    )
    useEffect(() => {
        if (typeof window !== "undefined") {
            const s = getExperimentState()
            setExperimentState(s)
        }
    }, [])

    // Note: yColumns is not passed here, which means the short column names
    // option won't be visible in the download section on data pages. To enable
    // this feature, we'd need to load variable metadata on the server and pass
    // the column definitions through to this component.
    const downloadSection = slug ? (
        <DataPageDownloadSection
            slug={slug}
            baseUrl={`${BAKED_GRAPHER_URL}/${slug}`}
            distribution={distribution}
            archivedChartInfo={archiveContext}
        />
    ) : undefined

    return (
        <AttachmentsContext.Provider
            value={{
                linkedDocuments: {},
                imageMetadata,
                linkedCharts: {},
                linkedIndicators: {},
                linkedAuthors: datapageData.linkedAuthors,
                relatedCharts: [],
                tags: [],
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                {/* Prototype aid: a dp… param that couldn't be used is shown,
                    not silently ignored, so a typo doesn't look like a bug. */}
                {perspectivesVariant.ignored.length > 0 &&
                    !ignoredParamsDismissed && (
                        <div className="dp-ignored-params" role="status">
                            <span>
                                Ignored:{" "}
                                <code>
                                    {perspectivesVariant.ignored.join("  ")}
                                </code>
                            </span>
                            <button
                                type="button"
                                aria-label="Dismiss"
                                onClick={() => setIgnoredParamsDismissed(true)}
                            >
                                ×
                            </button>
                        </div>
                    )}
                {grapherConfig.slug && perspectivesVariant.drawer !== "off" && (
                    <DataPerspectivesDrawer
                        mode={perspectivesVariant.drawer}
                        layout={perspectivesVariant.drawerLayout}
                        chrome={perspectivesVariant.chrome}
                        slug={grapherConfig.slug}
                        perspectives={perspectives}
                        relatedPages={[
                            ...(RELATED_DATA_PAGES[grapherConfig.slug] ?? []),
                            ...relatedCharts,
                        ].map((c) => ({
                            title: c.title,
                            url: `/grapher/${c.slug}`,
                            slug: c.slug,
                        }))}
                        relatedArticles={(relatedResearch ?? []).map((r) => ({
                            title: r.title,
                            url: r.url,
                            imageUrl: r.imageUrl,
                        }))}
                        onSelect={applyPerspective}
                        metadataSlot={
                            useNewDatapageDesign ? (
                                <IndicatorMetadataBox
                                    datapageData={datapageData}
                                    faqEntries={faqEntries}
                                    canonicalUrl={canonicalUrl}
                                    archiveContext={archiveContext}
                                    license={grapherConfig.license}
                                />
                            ) : undefined
                        }
                    />
                )}
                <div
                    className="DataPageContent__grapher-for-embed"
                    data-dod-track-note="grapher"
                >
                    <GrapherWithFallback
                        config={mergedGrapherConfig}
                        useProvidedConfigOnly
                        slug={grapherConfig.slug}
                        queryStr={queryStr}
                        enablePopulatingUrlParams
                        isEmbeddedInAnOwidPage={false}
                        isEmbeddedInADataPage={false}
                        isPreviewing={isPreviewing}
                    />
                </div>
                <div className="DataPageContent grid grid-cols-12-full-width">
                    <div className="span-cols-14 grid grid-cols-12-full-width full-width--border">
                        <div
                            className="chart-key-info col-start-2 span-cols-12"
                            data-dod-track-note="grapher"
                        >
                            {grapherConfig.slug && isExplorer ? (
                                <GuidedChartContext.Provider
                                    value={{
                                        grapherStateRef:
                                            grapherStateRef as React.RefObject<GrapherState>,
                                        chartRef:
                                            chartRef as React.RefObject<HTMLDivElement>,
                                        onGuidedChartLinkClick:
                                            handlePerspectiveSelect,
                                    }}
                                >
                                    <DataPerspectivesExplorer
                                        perspectives={perspectives}
                                        hintDelayMs={
                                            perspectivesVariant.hintDelayMs
                                        }
                                        axes={perspectivesVariant.axes}
                                        relatedArticles={(
                                            relatedResearch ?? []
                                        ).map((r) => ({
                                            title: r.title,
                                            url: r.url,
                                        }))}
                                        relatedPages={[
                                            ...(RELATED_DATA_PAGES[
                                                grapherConfig.slug
                                            ] ?? []),
                                            ...relatedCharts,
                                        ].map((c) => ({
                                            title: c.title,
                                            url: `/grapher/${c.slug}?dpLayout=explorer&dpAxes=${perspectivesVariant.axes}`,
                                        }))}
                                        onSelect={(_queryParams, index) =>
                                            applyPerspective(index)
                                        }
                                        chartSlot={
                                            <div ref={chartRef}>
                                                <GrapherWithFallback
                                                    slug={grapherConfig.slug}
                                                    config={mergedGrapherConfig}
                                                    useProvidedConfigOnly
                                                    queryStr={queryStr}
                                                    isEmbeddedInADataPage={true}
                                                    isEmbeddedInAnOwidPage={
                                                        false
                                                    }
                                                    isPreviewing={isPreviewing}
                                                />
                                            </div>
                                        }
                                        metadataSlot={
                                            <IndicatorMetadataBox
                                                datapageData={datapageData}
                                                faqEntries={faqEntries}
                                                canonicalUrl={canonicalUrl}
                                                archiveContext={archiveContext}
                                                license={grapherConfig.license}
                                            />
                                        }
                                    />
                                </GuidedChartContext.Provider>
                            ) : grapherConfig.slug &&
                              perspectivesVariant.layout === "accordion" ? (
                                // This variant replaces the page's grapher
                                // outright: the page becomes a list of
                                // perspectives, each expanding into its own
                                // chart.
                                <DataPerspectivesAccordion
                                    slug={grapherConfig.slug}
                                    perspectives={perspectives}
                                    thumbQueryString={(queryParams) =>
                                        thumbQueryString(
                                            queryParams,
                                            perspectivesVariant.chrome
                                        )
                                    }
                                    renderGrapher={(queryParams) => (
                                        <GrapherWithFallback
                                            key={queryParams}
                                            slug={grapherConfig.slug}
                                            // Several graphers take turns here;
                                            // none of them should own the URL.
                                            config={{
                                                ...mergedGrapherConfig,
                                                bindUrlToWindow: false,
                                            }}
                                            useProvidedConfigOnly
                                            queryStr={`?${queryParams}`}
                                            isEmbeddedInADataPage={true}
                                            isEmbeddedInAnOwidPage={false}
                                            isPreviewing={isPreviewing}
                                        />
                                    )}
                                />
                            ) : grapherConfig.slug ? (
                                <GuidedChartContext.Provider
                                    value={{
                                        grapherStateRef:
                                            grapherStateRef as React.RefObject<GrapherState>,
                                        chartRef:
                                            chartRef as React.RefObject<HTMLDivElement>,
                                        onGuidedChartLinkClick:
                                            handlePerspectiveSelect,
                                    }}
                                >
                                    <div
                                        className={cx(
                                            "chart-with-perspectives",
                                            `chart-with-perspectives--${perspectivesVariant.position}`,
                                            {
                                                // Pageswipe always leads with
                                                // the perspective, whatever `dp`
                                                // says: it's the headline.
                                                "chart-with-perspectives--pageswipe":
                                                    perspectivesVariant.layout ===
                                                    "pageswipe",
                                                [`chart-with-perspectives--style-${perspectivesVariant.style}`]:
                                                    perspectivesVariant.layout ===
                                                    "pageswipe",
                                                // A stale narrative title,
                                                // struck through and greyed.
                                                "chart-with-perspectives--narrative-disabled":
                                                    isNarrative &&
                                                    narrativeStale &&
                                                    perspectivesVariant.narrativeStale ===
                                                        "disable",
                                                // A stale narrative title,
                                                // blanked to whitespace.
                                                "chart-with-perspectives--narrative-hidden":
                                                    isNarrative &&
                                                    narrativeStale &&
                                                    perspectivesVariant.narrativeStale ===
                                                        "hide",
                                            }
                                        )}
                                        ref={chartRef}
                                    >
                                        <GrapherWithFallback
                                            slug={grapherConfig.slug}
                                            config={mergedGrapherConfig}
                                            useProvidedConfigOnly
                                            id="explore-the-data"
                                            queryStr={queryStr}
                                            enablePopulatingUrlParams
                                            isEmbeddedInADataPage={true}
                                            isEmbeddedInAnOwidPage={false}
                                            isPreviewing={isPreviewing}
                                        />
                                        <DataPerspectives
                                            slug={grapherConfig.slug}
                                            perspectives={perspectives}
                                            variant={perspectivesVariant}
                                            onSelect={(_href, index) =>
                                                applyPerspective(index)
                                            }
                                            onReset={handlePerspectiveReset}
                                            narrativeStale={narrativeStale}
                                            onRestoreNarrative={
                                                restoreNarrative
                                            }
                                        />
                                    </div>
                                </GuidedChartContext.Provider>
                            ) : null}
                            {!useNewDatapageDesign && (
                                <AboutThisData
                                    datapageData={datapageData}
                                    hasFaq={!!faqEntries?.faqs.length}
                                    id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                                />
                            )}
                        </div>
                        {useNewDatapageDesign &&
                            !isExplorer &&
                            perspectivesVariant.drawer !== "metadata" && (
                                <IndicatorMetadataBox
                                    datapageData={datapageData}
                                    faqEntries={faqEntries}
                                    canonicalUrl={canonicalUrl}
                                    archiveContext={archiveContext}
                                    id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                                    license={grapherConfig.license}
                                />
                            )}
                        {useNewDatapageDesign &&
                            relatedResearch &&
                            relatedResearch.length > 0 && (
                                <div className="datapage-research-and-writing-v2 col-start-2 span-cols-12">
                                    <DataPageResearchAndWriting
                                        relatedResearch={relatedResearch}
                                    />
                                </div>
                            )}

                        {useNewDatapageDesign && relatedCharts.length > 0 && (
                            <>
                                <h2 className="datapage-v2__related-charts-heading span-cols-12 col-start-2 h2-bold">
                                    Related charts
                                </h2>
                                <div className="span-cols-14 grid grid-cols-12-full-width">
                                    <RelatedDataCharts
                                        className="col-start-2 span-cols-12"
                                        charts={relatedCharts}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    {useNewDatapageDesign &&
                        downloadSection && (
                            // The new design moves sources/processing/citations into
                            // the IndicatorMetadataBox above, so only the data
                            // download remains here. Rendered with the same wrapper
                            // markup MetadataSection used so the layout is unchanged.
                            <div className="MetadataSection span-cols-14 grid grid-cols-12-full-width">
                                <div className="col-start-2 span-cols-12">
                                    <div className="section-wrapper grid">
                                        {downloadSection}
                                    </div>
                                </div>
                            </div>
                        )}
                    {!useNewDatapageDesign && (
                        <>
                            <div className="col-start-2 span-cols-12">
                                {relatedResearch &&
                                    relatedResearch.length > 0 && (
                                        <DataPageResearchAndWriting
                                            relatedResearch={relatedResearch}
                                        />
                                    )}
                                {datapageData.allCharts &&
                                datapageData.allCharts.length > 0 ? (
                                    <div
                                        className={`section-wrapper section-wrapper__related-charts ${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1${EXPERIMENT_ARM_SEPARATOR}featured-metrics--hide`}
                                    >
                                        <h2
                                            className="related-charts__title"
                                            id="all-charts"
                                        >
                                            Explore charts that include this
                                            data
                                        </h2>
                                        <div>
                                            <RelatedCharts
                                                charts={datapageData.allCharts}
                                            />
                                        </div>
                                    </div>
                                ) : null}
                                {datapageData.primaryTopic && (
                                    <div
                                        className={`section-wrapper ${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1${EXPERIMENT_ARM_SEPARATOR}featured-metrics--show`}
                                        id={
                                            experimentState &&
                                            experimentState[
                                                `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                            ]?.isPageInExperiment &&
                                            experimentState[
                                                `${EXPERIMENT_PREFIX}-all-charts-vs-featured-v1`
                                            ]?.arm === "featured-metrics"
                                                ? "all-charts"
                                                : ""
                                        }
                                    >
                                        <SiteQueryClientProvider>
                                            <FeaturedMetrics
                                                topicName={
                                                    datapageData.primaryTopic
                                                        .topicTag
                                                }
                                                isDataPage={true}
                                            />
                                        </SiteQueryClientProvider>
                                    </div>
                                )}
                            </div>
                            <MetadataSection
                                attributionShort={datapageData.attributionShort}
                                attributions={datapageData.attributions}
                                canonicalUrl={canonicalUrl}
                                descriptionProcessing={
                                    datapageData.descriptionProcessing
                                }
                                faqEntries={faqEntries}
                                license={grapherConfig.license}
                                origins={datapageData.origins}
                                owidProcessingLevel={
                                    datapageData.owidProcessingLevel
                                }
                                primaryTopic={datapageData.primaryTopic}
                                source={datapageData.source}
                                title={datapageData.title}
                                titleVariant={datapageData.titleVariant}
                                archiveContext={archiveContext}
                                downloadSection={downloadSection}
                            />
                        </>
                    )}
                </div>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}
