import * as _ from "lodash-es"
import { runInAction } from "mobx"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { unstable_batchedUpdates } from "react-dom"
import { useSearchParams } from "react-router-dom-v5-compat"
import * as Sentry from "@sentry/react"
import { useIsClient } from "usehooks-ts"
import { DownloadIconComplete } from "@ourworldindata/components"
import {
    DownloadModalTabName,
    Grapher,
    GrapherManager,
    GrapherModal,
    GrapherState,
    getCachingInputTableFetcher,
    loadCatalogData,
    useElementBounds,
} from "@ourworldindata/grapher"
import {
    joinTitleFragments,
    MultiDimDataPageConfig,
    extractMultiDimChoicesFromSearchParams,
    isInIFrame,
} from "@ourworldindata/utils"
import {
    ArchiveContext,
    DataPageRelatedResearch,
    FaqEntryKeyedByGdocIdAndFragmentId,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherQueryParams,
    HIDE_IF_JS_DISABLED_CLASSNAME,
    HIDE_IF_JS_ENABLED_CLASSNAME,
    ImageMetadata,
    MultiDimDataPageConfigEnriched,
    MultiDimDimensionChoices,
    MultiDimDataPageInitialViewData,
    PrimaryTopic,
} from "@ourworldindata/types"
import AboutThisData from "../AboutThisData.js"
import MetadataSection from "../MetadataSection.js"
import DownloadSection from "../DownloadSection.js"
import GrapherImage from "../GrapherImage.js"
import { useMobxStateToReactState } from "../hooks.js"
import { MultiDimSettingsPanel } from "./MultiDimDataPageSettingsPanel.js"
import { getDatapageDataV2, processRelatedResearch } from "../dataPage.js"
import DataPageResearchAndWriting from "../DataPageResearchAndWriting.js"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import {
    cachedGetGrapherConfigByUuid,
    cachedGetVariableMetadata,
} from "./api.js"
import MultiDim from "./MultiDim.js"
import { useBaseGrapherConfig, useMultiDimAnalytics } from "./hooks.js"
import {
    DATA_API_URL,
    BAKED_GRAPHER_URL,
    ADMIN_BASE_URL,
    CATALOG_URL,
} from "../../settings/clientSettings.js"

export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"
const isIframe = isInIFrame()

const useTitleFragments = (config: MultiDimDataPageConfig) => {
    const title = config.config.title
    return useMemo(
        () => joinTitleFragments(title.titleVariant, title.attributionShort),
        [title]
    )
}

// Opens the chart's download modal on the Data tab. Desktop only: the package
// is a zip, which is an awkward thing to receive on a phone, so it doesn't earn
// prominent placement there. Mobile readers can still reach the same three
// options through the chart's own Download button.
//
// Its only behaviour is opening the modal, so it's hidden without JavaScript,
// same as the interactive chart below it — the download section further down the
// page works either way.
function DownloadTheDataButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            className={`download-the-data-button ${HIDE_IF_JS_DISABLED_CLASSNAME}`}
            onClick={onClick}
            data-track-note="datapage_download_the_data_button"
        >
            <DownloadIconComplete color="currentColor" />
            Download the data
        </button>
    )
}

export type MultiDimDataPageContentProps = {
    canonicalUrl: string
    slug: string | null
    config: MultiDimDataPageConfig
    faqEntries?: FaqEntryKeyedByGdocIdAndFragmentId
    primaryTopic?: PrimaryTopic
    relatedResearchCandidates: DataPageRelatedResearch[]
    imageMetadata: Record<string, ImageMetadata>
    isPreviewing?: boolean
    archiveContext?: ArchiveContext
    initialViewData?: MultiDimDataPageInitialViewData
    initialViewDimensions?: MultiDimDimensionChoices
}

export type MultiDimDataPageData = Omit<
    MultiDimDataPageContentProps,
    "config"
> & {
    configObj: MultiDimDataPageConfigEnriched
}

declare global {
    interface Window {
        _OWID_MULTI_DIM_PROPS?: MultiDimDataPageData
    }
}

export function DataPageContent({
    slug,
    canonicalUrl,
    config,
    isPreviewing,
    faqEntries,
    primaryTopic,
    relatedResearchCandidates,
    imageMetadata,
    archiveContext,
    initialViewData,
    initialViewDimensions,
}: MultiDimDataPageContentProps) {
    const isOnArchivalPage = archiveContext?.type === "archive-page"
    const assetMap = isOnArchivalPage
        ? archiveContext.assets.runtime
        : undefined
    // Built and published to R2 by ETL, so there's nothing to compute here --
    // `url` already points at the finished zip. The dimension controls are
    // always visible on the data page itself, so unlike the embedded case (see
    // MultiDim.tsx) it's always safe to offer.
    //
    // Except on an archival page: the package lives in ETL's bucket and isn't
    // copied into the append-only archive, so a snapshot linking it would hand
    // out data that has since moved on, or 404 once the object is replaced.
    const downloadPackage = isOnArchivalPage
        ? undefined
        : config.config.downloadPackage
    // A non-empty manager is used in the size calculations
    // within grapher, so we have to initialize it early with
    // a truthy value
    const managerRef = useRef<GrapherManager>({
        adminEditPath: "",
        downloadPackage,
    })
    const grapherStateRef = useRef<GrapherState>(
        new GrapherState({
            additionalDataLoaderFn: (catalogKey) =>
                loadCatalogData(catalogKey, {
                    baseUrl: CATALOG_URL,
                    assetMap,
                }),
            manager: managerRef.current,
            archiveContext,
            isConfigReady: false,
        })
    )
    const grapherFigureRef = useRef<HTMLDivElement>(null)
    const [searchParams, setSearchParams] = useSearchParams()
    const [varDatapageData, setVarDatapageData] =
        useState<MultiDimDataPageInitialViewData | null>(
            initialViewData ?? null
        )
    const isClient = useIsClient()

    // Workaround to prevent a race condition when switching between views.
    // https://github.com/owid/owid-grapher/issues/5727
    const [isLoadingView, setIsLoadingView] = useState(false)

    const inputTableFetcher = useMemo(
        () =>
            getCachingInputTableFetcher(
                DATA_API_URL,
                archiveContext,
                isPreviewing
            ),
        [archiveContext, isPreviewing]
    )

    const titleFragments = useTitleFragments(config)
    const additionalConfig = useMemo(
        () => ({ archiveContext }),
        [archiveContext]
    )
    const baseGrapherConfig = useBaseGrapherConfig(additionalConfig)

    const settings = useMemo(() => {
        const choices = extractMultiDimChoicesFromSearchParams(
            searchParams,
            config
        )
        return config.filterToAvailableChoices(choices).selectedChoices
    }, [searchParams, config])

    const displayedSettings = isClient
        ? settings
        : (initialViewDimensions ?? settings)
    const displayedSearchParams = isClient
        ? searchParams
        : new URLSearchParams(initialViewDimensions)
    const fallbackQueryString = initialViewDimensions
        ? `?${new URLSearchParams(initialViewDimensions).toString()}`
        : ""

    const updateGrapher = useCallback(
        (
            grapherState: GrapherState,
            settings: MultiDimDimensionChoices,
            grapherQueryParams: GrapherQueryParams
        ) => {
            const newView = config.findViewByDimensions(settings)
            if (!newView) return

            const variableId = newView.indicators?.["y"]?.[0]?.id
            if (!variableId) return

            grapherState.isDataReady = false
            setIsLoadingView(true)

            const variableMetadataPromise = cachedGetVariableMetadata(
                variableId,
                Boolean(isPreviewing),
                assetMap
            )
            const grapherConfigUuid = newView.fullConfigId

            const grapherConfigPromise = cachedGetGrapherConfigByUuid(
                grapherConfigUuid,
                Boolean(isPreviewing),
                assetMap
            )
            const variables = newView.indicators?.["y"]
            const adminEditPath =
                variables?.length === 1
                    ? `variables/${variables[0].id}/config`
                    : undefined
            const analyticsContext = {
                slug: slug!,
                viewConfigId: grapherConfigUuid,
            }
            managerRef.current.adminEditPath = adminEditPath
            managerRef.current.analyticsContext = analyticsContext
            managerRef.current.adminCreateNarrativeChartPath = `narrative-charts/create?type=multiDim&chartConfigId=${grapherConfigUuid}`

            void Promise.all([variableMetadataPromise, grapherConfigPromise])
                .then(async ([variableMetadata, grapherConfig]) => {
                    const mergedMetadata = config.mergeViewMetadata(
                        settings,
                        variableMetadata
                    )
                    setVarDatapageData({
                        ...getDatapageDataV2(mergedMetadata, grapherConfig),
                        faqs: mergedMetadata.presentation?.faqs ?? [],
                    })

                    const grapherConfigWithBase = {
                        ...grapherConfig,
                        ...baseGrapherConfig,
                    }
                    const loadDataPromise = inputTableFetcher(
                        grapherConfig.dimensions!,
                        grapherConfig.selectedEntityColors
                    ).then((inputTable) => {
                        if (inputTable) grapherState.inputTable = inputTable
                    })

                    if (slug) {
                        grapherConfigWithBase.slug = slug // Needed for the URL used for sharing.
                    }
                    // Batch the grapher updates to avoid getting intermediate
                    // grapherChangedParams values, which make the URL update
                    // multiple times while flashing.
                    // https://stackoverflow.com/a/48610973/9846837

                    const previousTab = grapherState.activeTab

                    // TODO we may not need to this anymore in React 18.
                    unstable_batchedUpdates(() => {
                        grapherState.setAuthoredVersion(grapherConfigWithBase)
                        grapherState.reset()
                        grapherState.updateFromObject(grapherConfigWithBase)
                        grapherState.isConfigReady = true

                        grapherState.populateFromQueryParams(grapherQueryParams)
                    })

                    // The below code needs to run after the data has been loaded, so that it has access
                    // to the table and its time range
                    await loadDataPromise

                    grapherState.isDataReady = true

                    // When switching between mdim views, we usually preserve the tab.
                    // However, if the new chart doesn't support the previously selected tab,
                    // Grapher automatically switches to a supported one. In such cases,
                    // we call adjustStateForTab to make adjustments that ensure the new view
                    // is sensible (e.g. updating the time selection when switching from a
                    // single-time chart like a discrete bar chart to a multi-time chart like
                    // a line chart).
                    const currentTab = grapherState.activeTab
                    if (previousTab !== currentTab)
                        grapherState.adjustStateForTab(currentTab)
                })
                .catch(Sentry.captureException)
                .finally(() => setIsLoadingView(false))
        },
        [
            assetMap,
            config,
            inputTableFetcher,
            isPreviewing,
            slug,
            baseGrapherConfig,
        ]
    )

    const handleSettingsChange = useCallback(
        (settings: MultiDimDimensionChoices) => {
            const grapher = grapherStateRef.current
            if (!grapher) return

            const { selectedChoices } =
                config.filterToAvailableChoices(settings)
            const newSearchParams = {
                ...grapher.changedParams,
                ...selectedChoices,
            }
            const newGrapherParams: GrapherQueryParams = {
                ...newSearchParams,
                // Pass the previous tab to grapher, but don't set it in URL. We
                // want it set only when it's not the default, which is handled
                // by effect that depends on `grapherChangedParams`.
                tab: grapher.mapGrapherTabToQueryParam(grapher.activeTab),
            }

            // reset map state if switching to a chart
            if (newGrapherParams.tab !== GRAPHER_TAB_QUERY_PARAMS.map) {
                newGrapherParams.globe = "0"
                newGrapherParams.mapSelect = ""
            }

            setSearchParams(newSearchParams, { replace: true })
            updateGrapher(grapher, selectedChoices, newGrapherParams)
        },
        [config, setSearchParams, updateGrapher]
    )

    useMultiDimAnalytics(slug, config, settings)

    // Set state from query params on page load.
    useEffect(() => {
        const grapher = grapherStateRef.current
        if (!grapher) return
        const queryParams = {
            // On first page load, query params may be empty but settings are
            // already correctly computed, so include them (e.g. for embed
            // URLs).
            ...Object.fromEntries(searchParams.entries()),
            ...settings,
        }
        // this is not taking into account what used to be passed as "manager"
        grapher.externalBounds = bounds
        grapher.bakedGrapherURL = BAKED_GRAPHER_URL
        grapher.adminBaseUrl = ADMIN_BASE_URL
        updateGrapher(grapher, settings, queryParams)
        // NOTE (Martin): This is the only way I was able to set the initial
        // state on page load. Reconsider after the Grapher state refactor, i.e.
        // when we decouple Grapher state from the Grapher components. Adding
        // deps properly to the dep array leads to an infinite loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // De-mobx grapher.changedParams by transforming it into React state
    const grapherChangedParams = useMobxStateToReactState(
        useCallback(() => grapherStateRef.current?.changedParams, []),
        !!grapherStateRef.current
    )

    useEffect(() => {
        if (grapherChangedParams) {
            setSearchParams(
                { ...grapherChangedParams, ...settings },
                { replace: true }
            )
        }
    }, [grapherChangedParams, settings, setSearchParams])

    const grapherCurrentTitle = useMobxStateToReactState(
        useCallback(() => grapherStateRef.current?.currentTitle, []),
        !!grapherStateRef.current
    )

    const fullTitle = useMemo(() => {
        const grapherTitle = grapherCurrentTitle
        if (!grapherTitle) return undefined
        const mdimTitle = titleFragments
            ? `${config.config.title.title} - ${titleFragments}`
            : config.config.title.title
        return `${grapherTitle} | ${mdimTitle} | Our World in Data`
    }, [grapherCurrentTitle, titleFragments, config.config.title.title])

    useEffect(() => {
        if (fullTitle) {
            document.title = fullTitle
        }
    }, [fullTitle])

    const bounds = useElementBounds(grapherFigureRef)

    useEffect(() => {
        if (bounds) {
            grapherStateRef.current.externalBounds = bounds
        }
    }, [bounds])

    const relatedResearch = useMemo(
        () =>
            processRelatedResearch(
                relatedResearchCandidates ?? [],
                config.config.topicTags ?? []
            ),
        [relatedResearchCandidates, config.config.topicTags]
    )

    const faqEntriesForView = useMemo(() => {
        return _.compact(
            varDatapageData?.faqs?.flatMap(
                (faq) => faqEntries?.faqs?.[faq.gdocId]?.[faq.fragmentId]
            )
        )
    }, [varDatapageData?.faqs, faqEntries])

    const tableForDownload = useMobxStateToReactState(
        useCallback(() => grapherStateRef.current?.tableForDownload, []),
        !!grapherStateRef.current
    )
    const filteredTableForDownload = useMobxStateToReactState(
        useCallback(
            () => grapherStateRef.current?.filteredTableForDownload,
            []
        ),
        !!grapherStateRef.current
    )
    const yColumns = useMobxStateToReactState(
        useCallback(
            () => grapherStateRef.current?.yColumnsFromDimensionsOrSlugsOrAuto,
            []
        ),
        !!grapherStateRef.current
    )

    // The download section further down the page offers the same three options,
    // but scrolling there is jarring -- open the modal over the chart instead.
    const openDownloadModal = useCallback(() => {
        runInAction(() => {
            grapherStateRef.current.activeModal = GrapherModal.Download
            grapherStateRef.current.activeDownloadModalTab =
                DownloadModalTabName.Data
        })
        // The modal is positioned within the chart's frame, so make sure the
        // chart is in view. A no-op when it already is.
        grapherFigureRef.current?.scrollIntoView({ block: "nearest" })
    }, [])

    const downloadSection = slug ? (
        <DownloadSection
            slug={slug}
            baseUrl={`${BAKED_GRAPHER_URL}/${slug}`}
            searchParams={displayedSearchParams}
            externalQueryParams={displayedSettings}
            tableForDownload={tableForDownload}
            filteredTableForDownload={filteredTableForDownload}
            yColumns={yColumns}
            hideRowCounts={!isClient}
            archivedChartInfo={archiveContext}
            downloadPackage={downloadPackage}
        />
    ) : undefined

    return (
        <AttachmentsContext.Provider
            value={{
                linkedDocuments: {},
                imageMetadata,
                linkedCharts: {},
                linkedIndicators: {},
                relatedCharts: [],
                tags: [],
            }}
        >
            <div className="DataPageContent MultiDimDataPageContent grid grid-cols-12-full-width">
                <div className="bg-blue-10 span-cols-14">
                    <div className="header__wrapper grid grid-cols-12-full-width">
                        <div className="header__left col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
                            <div className="header__supertitle">Data</div>
                            <h1 className="header__title">
                                {config.config.title.title}
                            </h1>
                            <div className="header__source">
                                {titleFragments}
                            </div>
                        </div>
                        {downloadPackage && (
                            <div className="header__actions col-start-10 span-cols-4">
                                <DownloadTheDataButton
                                    onClick={openDownloadModal}
                                />
                            </div>
                        )}
                        <div className="settings-row__wrapper col-start-2 span-cols-12 col-sm-start-2 span-sm-cols-12">
                            <MultiDimSettingsPanel
                                className="settings-row__panel"
                                config={config}
                                settings={displayedSettings}
                                onChange={handleSettingsChange}
                                disabled={isLoadingView}
                            />
                        </div>
                    </div>
                </div>

                <div className="span-cols-14 grid grid-cols-12-full-width full-width--border">
                    <div className="chart-key-info col-start-2 span-cols-12">
                        <div
                            id="explore-the-data"
                            className="GrapherWithFallback full-width-on-mobile"
                        >
                            <figure
                                className={HIDE_IF_JS_DISABLED_CLASSNAME}
                                data-grapher-src
                                ref={grapherFigureRef}
                            >
                                <Grapher
                                    grapherState={grapherStateRef.current}
                                />
                            </figure>
                            {slug && (
                                <figure
                                    className={`${HIDE_IF_JS_ENABLED_CLASSNAME} GrapherWithFallback__fallback`}
                                >
                                    <GrapherImage
                                        slug={slug}
                                        queryString={fallbackQueryString}
                                        alt={config.config.title.title}
                                        enablePopulatingUrlParams
                                    />
                                    <p>
                                        Interactive visualization requires
                                        JavaScript.
                                    </p>
                                </figure>
                            )}
                        </div>
                        {varDatapageData && (
                            <AboutThisData
                                datapageData={varDatapageData}
                                hasFaq={!!faqEntriesForView?.length}
                            />
                        )}
                    </div>
                </div>
                <div className="col-start-2 span-cols-12">
                    {relatedResearch && relatedResearch.length > 0 && (
                        <DataPageResearchAndWriting
                            relatedResearch={relatedResearch}
                        />
                    )}
                </div>
                {varDatapageData && (
                    <MetadataSection
                        attributionShort={varDatapageData.attributionShort}
                        attributions={varDatapageData.attributions}
                        canonicalUrl={canonicalUrl}
                        descriptionProcessing={
                            varDatapageData.descriptionProcessing
                        }
                        faqEntries={{ faqs: faqEntriesForView }}
                        license={varDatapageData.license}
                        origins={varDatapageData.origins}
                        owidProcessingLevel={
                            varDatapageData.owidProcessingLevel
                        }
                        primaryTopic={primaryTopic}
                        source={varDatapageData.source}
                        title={varDatapageData.title}
                        titleVariant={varDatapageData.titleVariant}
                        archiveContext={archiveContext}
                        downloadSection={downloadSection}
                    />
                )}
            </div>
        </AttachmentsContext.Provider>
    )
}

export function MultiDimDataPageContent({
    slug,
    canonicalUrl,
    config,
    isPreviewing,
    faqEntries,
    primaryTopic,
    relatedResearchCandidates,
    imageMetadata,
    archiveContext,
    initialViewData,
    initialViewDimensions,
}: MultiDimDataPageContentProps) {
    return isIframe ? (
        <MultiDim
            config={config}
            slug={slug}
            queryStr={location.search}
            archiveContext={archiveContext}
            isPreviewing={isPreviewing}
        />
    ) : (
        <DataPageContent
            slug={slug}
            canonicalUrl={canonicalUrl}
            config={config}
            isPreviewing={isPreviewing}
            faqEntries={faqEntries}
            primaryTopic={primaryTopic}
            relatedResearchCandidates={relatedResearchCandidates}
            imageMetadata={imageMetadata}
            archiveContext={archiveContext}
            initialViewData={initialViewData}
            initialViewDimensions={initialViewDimensions}
        />
    )
}
