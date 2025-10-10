import * as _ from "lodash-es"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { unstable_batchedUpdates } from "react-dom"
import { useSearchParams } from "react-router-dom-v5-compat"
import * as Sentry from "@sentry/react"
import {
    Grapher,
    GrapherState,
    getCachingInputTableFetcher,
    GrapherManager,
    loadVariableDataAndMetadata,
} from "@ourworldindata/grapher"
import {
    DataPageDataV2,
    joinTitleFragments,
    MultiDimDataPageConfig,
    extractMultiDimChoicesFromSearchParams,
    isInIFrame,
} from "@ourworldindata/utils"
import {
    ArchiveContext,
    DataPageRelatedResearch,
    FaqEntryKeyedByGdocIdAndFragmentId,
    FaqLink,
    GRAPHER_TAB_QUERY_PARAMS,
    GrapherQueryParams,
    ImageMetadata,
    MultiDimDataPageConfigEnriched,
    MultiDimDimensionChoices,
    PrimaryTopic,
} from "@ourworldindata/types"
import AboutThisData from "../AboutThisData.js"
import TopicTags from "../TopicTags.js"
import MetadataSection from "../MetadataSection.js"
import { useElementBounds, useMobxStateToReactState } from "../hooks.js"
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

export type MultiDimDataPageContentProps = {
    canonicalUrl: string
    slug: string | null
    config: MultiDimDataPageConfig
    tagToSlugMap?: Record<string, string>
    faqEntries?: FaqEntryKeyedByGdocIdAndFragmentId
    primaryTopic?: PrimaryTopic
    relatedResearchCandidates: DataPageRelatedResearch[]
    imageMetadata: Record<string, ImageMetadata>
    isPreviewing?: boolean
    archiveContext?: ArchiveContext
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

interface VariableDataPageData extends DataPageDataV2 {
    faqs: FaqLink[]
}

export function DataPageContent({
    slug,
    canonicalUrl,
    config,
    isPreviewing,
    faqEntries,
    primaryTopic,
    relatedResearchCandidates,
    tagToSlugMap,
    imageMetadata,
    archiveContext,
}: MultiDimDataPageContentProps) {
    const assetMap =
        archiveContext?.type === "archive-page"
            ? archiveContext.assets.runtime
            : undefined
    // A non-empty manager is used in the size calculations
    // within grapher, so we have to initialize it early with
    // a truthy value
    const managerRef = useRef<GrapherManager>({ adminEditPath: "" })
    const grapherStateRef = useRef<GrapherState>(
        new GrapherState({
            additionalDataLoaderFn: (varId: number) =>
                loadVariableDataAndMetadata(varId, DATA_API_URL, {
                    assetMap,
                    noCache: isPreviewing,
                }),
            manager: managerRef.current,
            archiveContext,
            isConfigReady: false,
        })
    )
    const grapherFigureRef = useRef<HTMLDivElement>(null)
    const [searchParams, setSearchParams] = useSearchParams()
    const [varDatapageData, setVarDatapageData] =
        useState<VariableDataPageData | null>(null)
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

            const datapageDataPromise = cachedGetVariableMetadata(
                variableId,
                Boolean(isPreviewing),
                assetMap
            ).then((json) => {
                const mergedMetadata = _.mergeWith(
                    {}, // merge mutates the first argument
                    json,
                    config.config?.metadata,
                    newView.metadata,
                    // Overwrite arrays completely instead of merging them.
                    // Otherwise fall back to the default merge behavior.
                    (_, srcValue) => {
                        return Array.isArray(srcValue) ? srcValue : undefined
                    }
                )
                return {
                    ...getDatapageDataV2(mergedMetadata, newView.config ?? {}),
                    faqs: mergedMetadata.presentation?.faqs ?? [],
                }
            })
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
                mdimSlug: slug!,
                mdimViewConfigId: grapherConfigUuid,
            }
            managerRef.current.adminEditPath = adminEditPath
            managerRef.current.analyticsContext = analyticsContext
            managerRef.current.adminCreateNarrativeChartPath = `narrative-charts/create?type=multiDim&chartConfigId=${grapherConfigUuid}`

            void Promise.allSettled([datapageDataPromise, grapherConfigPromise])
                .then(async ([datapageData, grapherConfig]) => {
                    if (datapageData.status === "rejected")
                        throw new Error(
                            `Fetching variable by uuid failed: ${grapherConfigUuid}`,
                            { cause: datapageData.reason }
                        )
                    setVarDatapageData(datapageData.value)
                    if (grapherConfig.status === "fulfilled") {
                        const config = {
                            ...grapherConfig.value,
                            ...baseGrapherConfig,
                        }
                        void inputTableFetcher(
                            grapherConfig.value.dimensions!,
                            grapherConfig.value.selectedEntityColors
                        ).then((inputTable) => {
                            if (inputTable) grapherState.inputTable = inputTable
                        })

                        if (slug) {
                            config.slug = slug // Needed for the URL used for sharing.
                        }
                        // Batch the grapher updates to avoid getting intermediate
                        // grapherChangedParams values, which make the URL update
                        // multiple times while flashing.
                        // https://stackoverflow.com/a/48610973/9846837

                        const previousTab = grapherState.activeTab

                        // TODO we may not need to this anymore in React 18.
                        unstable_batchedUpdates(() => {
                            grapherState.setAuthoredVersion(config)
                            grapherState.reset()
                            grapherState.updateFromObject(config)
                            grapherState.isConfigReady = true

                            grapherState.populateFromQueryParams(
                                grapherQueryParams
                            )

                            // When switching between mdim views, we usually preserve the tab.
                            // However, if the new chart doesn't support the previously selected tab,
                            // Grapher automatically switches to a supported one. In such cases,
                            // we call onChartSwitching to make adjustments that ensure the new view
                            // is sensible (e.g. updating the time selection when switching from a
                            // single-time chart like a discrete bar chart to a multi-time chart like
                            // a line chart).
                            const currentTab = grapherState.activeTab
                            if (previousTab !== currentTab)
                                grapherState.onChartSwitching(
                                    previousTab,
                                    currentTab
                                )
                        })
                    }
                })
                .catch(Sentry.captureException)
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

    useEffect(() => {
        if (grapherCurrentTitle) {
            document.title = grapherCurrentTitle
        }
    }, [grapherCurrentTitle])

    const bounds = useElementBounds(grapherFigureRef)

    useEffect(() => {
        if (bounds) {
            grapherStateRef.current.externalBounds = bounds
        }
    }, [bounds])

    const hasTopicTags = !!config.config.topicTags?.length

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
                        {hasTopicTags && tagToSlugMap && (
                            <TopicTags
                                className="header__right col-start-10 span-cols-4 col-sm-start-2 span-sm-cols-12"
                                topicTagsLinks={config.config.topicTags ?? []}
                                tagToSlugMap={tagToSlugMap}
                            />
                        )}
                        <div className="settings-row__wrapper col-start-2 span-cols-12 col-sm-start-2 span-sm-cols-12">
                            <MultiDimSettingsPanel
                                config={config}
                                settings={settings}
                                onChange={handleSettingsChange}
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
                            <figure data-grapher-src ref={grapherFigureRef}>
                                <Grapher
                                    grapherState={grapherStateRef.current}
                                />
                            </figure>
                        </div>
                        <div className="js--show-warning-block-if-js-disabled" />
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
                        origins={varDatapageData.origins}
                        owidProcessingLevel={
                            varDatapageData.owidProcessingLevel
                        }
                        primaryTopic={primaryTopic}
                        source={varDatapageData.source}
                        title={varDatapageData.title}
                        titleVariant={varDatapageData.titleVariant}
                        archiveContext={archiveContext}
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
    tagToSlugMap,
    imageMetadata,
    archiveContext,
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
            tagToSlugMap={tagToSlugMap}
            imageMetadata={imageMetadata}
            archiveContext={archiveContext}
        />
    )
}
