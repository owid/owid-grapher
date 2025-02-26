import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Grapher,
    GrapherAnalytics,
    GrapherProgrammaticInterface,
    getVariableMetadataRoute,
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
    OwidVariableWithSourceAndDimension,
    memoize,
    setWindowQueryStr,
    compact,
    MultiDimDataPageConfig,
    extractMultiDimChoicesFromQueryStr,
    multiDimStateToQueryStr,
    merge,
    omit,
    fetchWithRetry,
} from "@ourworldindata/utils"
import cx from "classnames"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"
import {
    DataPageRelatedResearch,
    FaqEntryKeyedByGdocIdAndFragmentId,
    ImageMetadata,
    MultiDimDataPageConfigEnriched,
    MultiDimDimensionChoices,
    PrimaryTopic,
    ViewEnriched,
} from "@ourworldindata/types"
import AboutThisData from "../AboutThisData.js"
import TopicTags from "../TopicTags.js"
import MetadataSection from "../MetadataSection.js"
import { useElementBounds, useMobxStateToReactState } from "../hooks.js"
import { MultiDimSettingsPanel } from "./MultiDimDataPageSettingsPanel.js"
import { processRelatedResearch } from "../dataPage.js"
import DataPageResearchAndWriting from "../DataPageResearchAndWriting.js"
import { AttachmentsContext } from "../gdocs/AttachmentsContext.js"

declare global {
    interface Window {
        _OWID_MULTI_DIM_PROPS?: MultiDimDataPageContentProps
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

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

const cachedGetVariableMetadata = memoize(
    (variableId: number): Promise<OwidVariableWithSourceAndDimension> =>
        fetchWithRetry(getVariableMetadataRoute(DATA_API_URL, variableId)).then(
            (resp) => resp.json()
        )
)

const cachedGetGrapherConfigByUuid = memoize(
    (
        grapherConfigUuid: string,
        isPreviewing: boolean
    ): Promise<GrapherInterface> => {
        return fetchWithRetry(
            `/grapher/by-uuid/${grapherConfigUuid}.config.json${isPreviewing ? "?nocache" : ""}`
        ).then((resp) => resp.json())
    }
)

const useTitleFragments = (config: MultiDimDataPageConfig) => {
    const title = config.config.title
    return useMemo(
        () => joinTitleFragments(title.titleVariant, title.attributionShort),
        [title]
    )
}

const useView = (
    currentSettings: MultiDimDimensionChoices,
    config: MultiDimDataPageConfig
) => {
    const currentView = useMemo(() => {
        if (Object.keys(currentSettings).length === 0) return undefined
        return config.findViewByDimensions(currentSettings)
    }, [currentSettings, config])
    return currentView
}

const useVarDatapageData = (
    config: MultiDimDataPageConfig,
    currentView: ViewEnriched | undefined,
    isPreviewing: boolean
) => {
    const [varDatapageData, setVarDatapageData] =
        useState<DataPageDataV2 | null>(null)
    const [grapherConfig, setGrapherConfig] = useState<GrapherInterface | null>(
        null
    )
    const [grapherConfigIsReady, setGrapherConfigIsReady] = useState(false)

    useEffect(() => {
        setGrapherConfigIsReady(false)
        setGrapherConfig(null)
        setVarDatapageData(null)
        const variableId = currentView?.indicators?.["y"]?.[0]?.id
        if (!variableId) return

        const datapageDataPromise = cachedGetVariableMetadata(variableId).then(
            (json) =>
                getDatapageDataV2(
                    merge(json, config.config?.metadata, currentView?.metadata),
                    currentView?.config
                )
        )
        const grapherConfigUuid = currentView?.fullConfigId
        const grapherConfigPromise = grapherConfigUuid
            ? cachedGetGrapherConfigByUuid(grapherConfigUuid, isPreviewing)
            : null

        Promise.allSettled([datapageDataPromise, grapherConfigPromise])
            .then(([datapageData, grapherConfig]) => {
                if (datapageData.status === "rejected")
                    throw new Error(
                        `Fetching variable by uuid failed: ${grapherConfigUuid}`,
                        { cause: datapageData.reason }
                    )

                setVarDatapageData(datapageData.value)
                setGrapherConfig(
                    grapherConfig.status === "fulfilled"
                        ? grapherConfig.value
                        : null
                )
                setGrapherConfigIsReady(true)
            })
            .catch(console.error)
    }, [
        config.config?.metadata,
        currentView?.fullConfigId,
        currentView?.indicators,
        currentView?.config,
        currentView?.metadata,
        isPreviewing,
    ])

    return {
        varDatapageData,
        varGrapherConfig: grapherConfig,
        grapherConfigIsReady,
    }
}

const analytics = new GrapherAnalytics()

export type MultiDimDataPageContentProps = {
    canonicalUrl: string
    slug: string | null
    configObj: MultiDimDataPageConfigEnriched
    tagToSlugMap?: Record<string, string>
    faqEntries?: FaqEntryKeyedByGdocIdAndFragmentId
    primaryTopic?: PrimaryTopic
    relatedResearchCandidates: DataPageRelatedResearch[]
    initialQueryStr?: string
    imageMetadata: Record<string, ImageMetadata>
    isPreviewing?: boolean
}

export const MultiDimDataPageContent = ({
    slug,
    canonicalUrl,
    // _datapageData,
    configObj,
    isPreviewing,
    faqEntries,
    primaryTopic,
    relatedResearchCandidates,
    tagToSlugMap,
    imageMetadata,
    initialQueryStr,
}: MultiDimDataPageContentProps) => {
    const grapherFigureRef = useRef<HTMLDivElement>(null)

    const config = useMemo(
        () => MultiDimDataPageConfig.fromObject(configObj),
        [configObj]
    )
    const titleFragments = useTitleFragments(config)

    const [currentSettings, setCurrentSettings] = useState(() => {
        const initialChoices = initialQueryStr
            ? extractMultiDimChoicesFromQueryStr(initialQueryStr, config)
            : {}
        const { selectedChoices } =
            config.filterToAvailableChoices(initialChoices)
        return selectedChoices
    })

    const currentView = useView(currentSettings, config)
    const { varDatapageData, varGrapherConfig, grapherConfigIsReady } =
        useVarDatapageData(config, currentView, isPreviewing ?? false)

    // This is the ACTUAL grapher instance being used, because GrapherFigureView/GrapherWithFallback are doing weird things and are not actually using the grapher instance we pass into it
    // and therefore we can not access the grapher state (e.g. tab, selection) from the grapher instance we pass into it
    // TODO we should probably fix that? seems sensible? change GrapherFigureView around a bit to use the actual grapher inst? or pass a GrapherProgrammaticInterface to it instead?
    const [grapherInst, setGrapherInst] = useState<Grapher | null>(null)

    // De-mobx grapher.changedParams by transforming it into React state
    const grapherChangedParams = useMobxStateToReactState(
        useCallback(() => grapherInst?.changedParams, [grapherInst]),
        !!grapherInst
    )

    const grapherCurrentTitle = useMobxStateToReactState(
        useCallback(() => grapherInst?.currentTitle, [grapherInst]),
        !!grapherInst
    )

    useEffect(() => {
        if (grapherCurrentTitle) {
            document.title = grapherCurrentTitle
        }
    }, [grapherCurrentTitle])

    const bounds = useElementBounds(grapherFigureRef)

    const queryStr = useMemo(
        () =>
            grapherChangedParams !== undefined
                ? multiDimStateToQueryStr(grapherChangedParams, currentSettings)
                : initialQueryStr,
        [grapherChangedParams, currentSettings, initialQueryStr]
    )

    useEffect(() => {
        setWindowQueryStr(queryStr ?? "")
    }, [queryStr])

    useEffect(() => {
        if (slug) analytics.logGrapherView(slug, currentSettings)
    }, [slug, currentSettings])

    const grapherConfigComputed = useMemo(() => {
        const baseConfig: GrapherProgrammaticInterface = {
            bounds,
            bakedGrapherURL: BAKED_GRAPHER_URL,
            adminBaseUrl: ADMIN_BASE_URL,
            dataApiUrl: DATA_API_URL,
            manager: {}, // Don't resize while data is loading.
        }

        if (!grapherConfigIsReady) return baseConfig
        const variables = currentView?.indicators?.["y"]
        const editUrl =
            variables?.length === 1
                ? `variables/${variables[0].id}/config`
                : undefined
        return {
            ...varGrapherConfig,
            ...baseConfig,
            manager: {
                canonicalUrl,
                editUrl,
            },
        }
    }, [
        varGrapherConfig,
        grapherConfigIsReady,
        bounds,
        canonicalUrl,
        currentView?.indicators,
    ])

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
            <div className="DataPageContent MultiDimDataPageContent">
                <div className="bg-blue-10">
                    <div className="header__wrapper wrapper grid grid-cols-12 ">
                        <div className="header__left span-cols-8 span-sm-cols-12">
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
                        <div
                            className={cx(
                                "settings-row__wrapper",
                                "span-sm-cols-12",
                                hasTopicTags ? "span-cols-9" : "span-cols-12"
                            )}
                        >
                            <MultiDimSettingsPanel
                                config={config}
                                currentSettings={currentSettings}
                                updateSettings={setCurrentSettings}
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
                                    key={JSON.stringify(
                                        omit(grapherConfigComputed, ["bounds"])
                                    )}
                                    {...grapherConfigComputed}
                                    queryStr={queryStr}
                                    getGrapherInstance={setGrapherInst}
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
                <div className="grid grid-cols-12-full-width">
                    <div className="col-start-2 span-cols-12">
                        {relatedResearch && relatedResearch.length > 0 && (
                            <DataPageResearchAndWriting
                                relatedResearch={relatedResearch}
                            />
                        )}
                    </div>
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
