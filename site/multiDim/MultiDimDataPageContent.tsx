import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { unstable_batchedUpdates } from "react-dom"
import { useSearchParams } from "react-router-dom-v5-compat"
import * as Sentry from "@sentry/react"
import {
    Grapher,
    GrapherAnalytics,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    DataPageDataV2,
    GrapherInterface,
    joinTitleFragments,
    OwidVariableWithSource,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    omitUndefinedValues,
    getAttributionFragmentsFromVariable,
    compact,
    MultiDimDataPageConfig,
    extractMultiDimChoicesFromSearchParams,
    merge,
    isInIFrame,
} from "@ourworldindata/utils"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"
import {
    DataPageRelatedResearch,
    FaqEntryKeyedByGdocIdAndFragmentId,
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
import { processRelatedResearch } from "../dataPage.js"
import DataPageResearchAndWriting from "../DataPageResearchAndWriting.js"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"
import {
    cachedGetGrapherConfigByUuid,
    cachedGetVariableMetadata,
} from "./api.js"
import MultiDim from "./MultiDim.js"

export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"
const isIframe = isInIFrame()

const baseGrapherConfig: GrapherProgrammaticInterface = {
    bakedGrapherURL: BAKED_GRAPHER_URL,
    adminBaseUrl: ADMIN_BASE_URL,
    dataApiUrl: DATA_API_URL,
    canHideExternalControlsInEmbed: true,
}

// From DataPageUtils
const getDatapageDataV2 = async (
    variableMetadata: OwidVariableWithSource,
    partialGrapherConfig: GrapherInterface | undefined
): Promise<DataPageDataV2> => {
    {
        const lastUpdated = getLastUpdatedFromVariable(variableMetadata) ?? ""
        const nextUpdate = getNextUpdateFromVariable(variableMetadata)
        const datapageJson: DataPageDataV2 = {
            status: "draft",
            title: variableMetadata.presentation?.titlePublic
                ? omitUndefinedValues({
                      title: variableMetadata.presentation?.titlePublic,
                      attributionShort:
                          variableMetadata.presentation?.attributionShort,
                      titleVariant: variableMetadata.presentation?.titleVariant,
                  })
                : {
                      title:
                          partialGrapherConfig?.title ??
                          variableMetadata.display?.name ??
                          variableMetadata.name ??
                          "",
                  },
            description: variableMetadata.description,
            descriptionShort: variableMetadata.descriptionShort,
            descriptionFromProducer: variableMetadata.descriptionFromProducer,
            attributionShort: variableMetadata.presentation?.attributionShort,
            titleVariant: variableMetadata.presentation?.titleVariant,
            topicTagsLinks: variableMetadata.presentation?.topicTagsLinks ?? [],
            attributions: getAttributionFragmentsFromVariable(variableMetadata),
            faqs: variableMetadata.presentation?.faqs ?? [],
            descriptionKey: variableMetadata.descriptionKey ?? [],
            descriptionProcessing: variableMetadata.descriptionProcessing,
            owidProcessingLevel: variableMetadata.processingLevel,
            dateRange: variableMetadata.timespan ?? "",
            lastUpdated: lastUpdated,
            nextUpdate: nextUpdate,
            allCharts: [],
            relatedResearch: [],
            source: variableMetadata.source,
            origins: variableMetadata.origins ?? [],
            chartConfig: partialGrapherConfig as Record<string, unknown>,
            unit: variableMetadata.display?.unit ?? variableMetadata.unit,
            unitConversionFactor: variableMetadata.display?.conversionFactor,
        }
        return datapageJson
    }
}

const useTitleFragments = (config: MultiDimDataPageConfig) => {
    const title = config.config.title
    return useMemo(
        () => joinTitleFragments(title.titleVariant, title.attributionShort),
        [title]
    )
}

const analytics = new GrapherAnalytics()

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
    tagToSlugMap,
    imageMetadata,
}: MultiDimDataPageContentProps) {
    const grapherRef = useRef<Grapher | null>(null)
    const grapherFigureRef = useRef<HTMLDivElement>(null)
    const [searchParams, setSearchParams] = useSearchParams()
    const [manager, setManager] = useState({})
    const [varDatapageData, setVarDatapageData] =
        useState<DataPageDataV2 | null>(null)
    const titleFragments = useTitleFragments(config)

    const settings = useMemo(() => {
        const choices = extractMultiDimChoicesFromSearchParams(
            searchParams,
            config
        )
        return config.filterToAvailableChoices(choices).selectedChoices
    }, [searchParams, config])

    useEffect(() => {
        if (slug) analytics.logGrapherView(slug, { view: settings })
    }, [slug, settings])

    const updateGrapher = useCallback(
        (
            grapher: Grapher,
            settings: MultiDimDimensionChoices,
            grapherQueryParams: GrapherQueryParams
        ) => {
            const newView = config.findViewByDimensions(settings)
            if (!newView) return

            const variableId = newView.indicators?.["y"]?.[0]?.id
            if (!variableId) return

            const datapageDataPromise = cachedGetVariableMetadata(
                variableId
            ).then((json) =>
                getDatapageDataV2(
                    merge(json, config.config?.metadata, newView.metadata),
                    newView.config
                )
            )
            const grapherConfigUuid = newView.fullConfigId
            const grapherConfigPromise = cachedGetGrapherConfigByUuid(
                grapherConfigUuid,
                isPreviewing ?? false
            )
            const variables = newView.indicators?.["y"]
            const editUrl =
                variables?.length === 1
                    ? `variables/${variables[0].id}/config`
                    : undefined
            setManager((prev) => ({ ...prev, editUrl }))

            void Promise.allSettled([datapageDataPromise, grapherConfigPromise])
                .then(([datapageData, grapherConfig]) => {
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
                        // Batch the grapher updates to avoid getting intermediate
                        // grapherChangedParams values, which make the URL update
                        // multiple times while flashing.
                        // https://stackoverflow.com/a/48610973/9846837
                        unstable_batchedUpdates(() => {
                            grapher.setAuthoredVersion(config)
                            grapher.reset()
                            grapher.updateFromObject(config)
                            grapher.downloadData()
                            grapher.populateFromQueryParams(grapherQueryParams)
                        })
                    }
                })
                .catch(Sentry.captureException)
        },
        [config, isPreviewing]
    )

    const handleSettingsChange = useCallback(
        (settings: MultiDimDimensionChoices) => {
            const grapher = grapherRef.current
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

            setSearchParams(newSearchParams, { replace: true })
            updateGrapher(grapher, selectedChoices, newGrapherParams)
        },
        [config, setSearchParams, updateGrapher]
    )

    // Set state from query params on page load.
    useEffect(() => {
        const grapher = grapherRef.current
        if (!grapher) return
        const queryParams = Object.fromEntries(searchParams.entries())
        updateGrapher(grapher, settings, queryParams)
        // NOTE (Martin): This is the only way I was able to set the initial
        // state on page load. Reconsider after the Grapher state refactor, i.e.
        // when we decouple Grapher state from the Grapher components. Adding
        // deps properly to the dep array leads to an infinite loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // De-mobx grapher.changedParams by transforming it into React state
    const grapherChangedParams = useMobxStateToReactState(
        useCallback(() => grapherRef.current?.changedParams, []),
        !!grapherRef.current
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
        useCallback(() => grapherRef.current?.currentTitle, []),
        !!grapherRef.current
    )

    useEffect(() => {
        if (grapherCurrentTitle) {
            document.title = grapherCurrentTitle
        }
    }, [grapherCurrentTitle])

    const bounds = useElementBounds(grapherFigureRef)

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
        return compact(
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
                                    ref={grapherRef}
                                    {...baseGrapherConfig}
                                    bounds={bounds}
                                    manager={manager}
                                />
                            </figure>
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
                        origins={varDatapageData.origins}
                        owidProcessingLevel={
                            varDatapageData.owidProcessingLevel
                        }
                        primaryTopic={primaryTopic}
                        source={varDatapageData.source}
                        title={varDatapageData.title}
                        titleVariant={varDatapageData.titleVariant}
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
}: MultiDimDataPageContentProps) {
    return isIframe ? (
        <MultiDim config={config} slug={slug} queryStr={location.search} />
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
        />
    )
}
