import React, { useEffect, useMemo, useRef, useState } from "react"
import {
    Grapher,
    GrapherManager,
    GrapherProgrammaticInterface,
    SelectionArray,
    getVariableMetadataRoute,
} from "@ourworldindata/grapher"
import ReactDOM from "react-dom"
import { RelatedCharts } from "../blocks/RelatedCharts.js"
import {
    DataPageV2ContentFields,
    formatAuthors,
    intersection,
    DataPageDataV2,
    GrapherInterface,
    joinTitleFragments,
    ImageMetadata,
    DimensionProperty,
    OwidVariableWithSource,
    getLastUpdatedFromVariable,
    getNextUpdateFromVariable,
    omitUndefinedValues,
    getAttributionFragmentsFromVariable,
    OwidVariableWithSourceAndDimension,
    memoize,
    GrapherTabOption,
    QueryParams,
    setWindowQueryStr,
    getWindowQueryParams,
    getWindowQueryStr,
} from "@ourworldindata/utils"
import cx from "classnames"
import { DebugProvider } from "../gdocs/DebugContext.js"
import { BAKED_BASE_URL, DATA_API_URL } from "../../settings/clientSettings.js"
import Image from "../gdocs/components/Image.js"
import { MultiDimDataPageConfig } from "./MultiDimDataPageConfig.js"
import { MultiDimDataPageConfigType } from "./MultiDimDataPageTypes.js"
import AboutThisData from "../AboutThisData.js"
import TopicTags from "../TopicTags.js"
import MetadataSection from "../MetadataSection.js"
import {
    extractDimensionChoicesFromQueryStr,
    stateToQueryStr,
} from "./MultiDimUrl.js"
import { reaction } from "mobx"
import { useElementBounds } from "../hooks.js"
import { MultiDimSettingsPanel } from "./MultiDimDataPageSettingsPanel.js"
declare global {
    interface Window {
        _OWID_MULTI_DIM_CONFIG: MultiDimDataPageConfigType
    }
}
export const OWID_DATAPAGE_CONTENT_ROOT_ID = "owid-datapageJson-root"

// https://blog.logrocket.com/accessing-previous-props-state-react-hooks/
function usePrevious<T>(value: T) {
    const ref = useRef<T>()
    useEffect(() => {
        ref.current = value
    }, [value])
    return ref.current
}

// We still have topic pages on WordPress, whose featured images are specified as absolute URLs which this component handles
// Once we've migrated all WP topic pages to gdocs, we'll be able to remove this component and just use <Image />
const DatapageResearchThumbnail = ({
    urlOrFilename,
}: {
    urlOrFilename: string | undefined | null
}) => {
    if (!urlOrFilename) {
        urlOrFilename = `${BAKED_BASE_URL}/default-thumbnail.jpg`
    }
    if (urlOrFilename.startsWith("http")) {
        return (
            <img
                src={urlOrFilename}
                className="span-lg-cols-2 span-sm-cols-3"
            />
        )
    }
    return (
        <Image
            filename={urlOrFilename}
            shouldLightbox={false}
            containerType="thumbnail"
            className="span-lg-cols-2 span-sm-cols-3"
        />
    )
}

// From DataPageUtils
const getDatapageDataV2 = async (
    variableMetadata: OwidVariableWithSource,
    partialGrapherConfig: GrapherInterface
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
                          partialGrapherConfig.title ??
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
            faqs: [],
            descriptionKey: variableMetadata.descriptionKey ?? [],
            descriptionProcessing: variableMetadata.descriptionProcessing,
            owidProcessingLevel: variableMetadata.processingLevel,
            dateRange: variableMetadata.timespan ?? "",
            lastUpdated: lastUpdated,
            nextUpdate: nextUpdate,
            relatedData: [],
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
        fetch(getVariableMetadataRoute(DATA_API_URL, variableId)).then((resp) =>
            resp.json()
        )
)

export const MultiDimDataPageContent = ({
    // _datapageData,
    config,
    grapherConfig,
    isPreviewing = false,
    faqEntries,
    canonicalUrl = "{URL}", // when we bake pages to their proper url this will be set correctly but on preview pages we leave this undefined
    tagToSlugMap,
    imageMetadata,
    initialQueryStr,
}: DataPageV2ContentFields & {
    config: MultiDimDataPageConfig
    grapherConfig: GrapherInterface
    imageMetadata: Record<string, ImageMetadata>
    initialQueryStr?: string
}) => {
    const grapherFigureRef = useRef<HTMLDivElement>(null)

    const [initialChoices] = useState(() =>
        initialQueryStr
            ? extractDimensionChoicesFromQueryStr(initialQueryStr, config)
            : {}
    )

    const datapageDataStub: Partial<DataPageDataV2> = {
        title: {
            title: config?.config.name ?? "",
            titleVariant: config?.config.dimensions_title,
        },
        titleVariant: config?.config.dimensions_title,
    }

    const [currentSettings, setCurrentSettings] = useState(initialChoices)

    const currentView = useMemo(() => {
        if (Object.keys(currentSettings).length === 0) return undefined
        return config?.findViewByDimensions(currentSettings)
    }, [currentSettings, config])

    const dimensionsConfig = useMemo(() => {
        const dimObj = MultiDimDataPageConfig.transformIndicatorPathObj(
            currentView?.indicator_path ?? {}
        )
        return Object.entries(dimObj).flatMap(([property, variableIds]) =>
            variableIds.flatMap((variableId) => ({
                property: property as DimensionProperty,
                variableId: parseInt(variableId),
            }))
        )
    }, [currentView])

    const [datapageDataFromVar, setDatapageDataFromVar] =
        useState<DataPageDataV2 | null>(null)

    useEffect(() => {
        setDatapageDataFromVar(null)
        const variableId = dimensionsConfig[0]?.variableId
        if (!variableId) return
        const variableMetadata = cachedGetVariableMetadata(variableId)

        variableMetadata
            .then((json) => getDatapageDataV2(json, grapherConfig))
            .then(setDatapageDataFromVar)
            .catch(console.error)
    }, [dimensionsConfig, grapherConfig])

    const titleFragments = joinTitleFragments(
        datapageDataFromVar?.attributionShort,
        datapageDataFromVar?.titleVariant
    )

    const topicTagsLinks = datapageDataFromVar?.topicTagsLinks?.filter(
        (tag) => tagToSlugMap?.[tag]
    )

    const selectionArray = useMemo(
        () => new SelectionArray(config.config.default_selection),
        [config]
    )

    const grapherManager = useMemo(
        (): GrapherManager => ({
            selection: selectionArray,
        }),
        [selectionArray]
    )

    // This is the ACTUAL grapher instance being used, because GrapherFigureView/GrapherWithFallback are doing weird things and are not actually using the grapher instance we pass into it
    // and therefore we can not access the grapher state (e.g. tab, selection) from the grapher instance we pass into it
    // TODO we should probably fix that? seems sensible? change GrapherFigureView around a bit to use the actual grapher inst? or pass a GrapherProgrammaticInterface to it instead?
    const [grapherInst, setGrapherInst] = useState<Grapher | null>(null)

    const [grapherChangedParams, setGrapherChangedParams] = useState<
        QueryParams | undefined
    >(undefined)

    // De-mobx grapher.changedParams by transforming it into React state
    useEffect(
        () =>
            grapherInst
                ? reaction(
                      () => grapherInst.changedParams,
                      setGrapherChangedParams,
                      { fireImmediately: true }
                  )
                : undefined,
        [grapherInst]
    )

    const bounds = useElementBounds(grapherFigureRef)

    const queryStr = useMemo(
        () =>
            grapherChangedParams !== undefined
                ? stateToQueryStr(grapherChangedParams, currentSettings)
                : initialQueryStr,
        [grapherChangedParams, currentSettings, initialQueryStr]
    )

    useEffect(() => {
        setWindowQueryStr(queryStr ?? "")
    }, [queryStr])

    const grapherConfigComputed = useMemo(() => {
        return {
            ...currentView?.config,
            dimensions: dimensionsConfig,
            isEmbeddedInADataPage: true,
            selectedEntityNames: config.config.default_selection,

            bounds,
        } as GrapherProgrammaticInterface
    }, [currentView, dimensionsConfig, bounds, config])

    // const grapher = useMemo(() => {
    //     const grapher = new Grapher({ ...grapherConfigComputed, queryStr })
    //     return grapher
    // }, [grapherConfigComputed, queryStr])

    const relatedResearchCandidates = datapageDataFromVar?.relatedResearch ?? []
    const relatedResearch =
        relatedResearchCandidates.length > 3 &&
        datapageDataFromVar?.topicTagsLinks?.length
            ? relatedResearchCandidates.filter((research) => {
                  const shared = intersection(
                      research.tags,
                      datapageDataFromVar?.topicTagsLinks ?? []
                  )
                  return shared.length > 0
              })
            : relatedResearchCandidates
    for (const item of relatedResearch) {
        // TODO: these are workarounds to not link to the (not really existing) template pages for energy or co2
        // country profiles but instead to the topic page at the country selector.
        if (item.url === "/co2-country-profile")
            item.url =
                "/co2-and-greenhouse-gas-emissions#co2-and-greenhouse-gas-emissions-country-profiles"
        else if (item.url === "/energy-country-profile")
            item.url = "/energy#country-profiles"
        else if (item.url === "/coronavirus-country-profile")
            item.url = "/coronavirus#coronavirus-country-profiles"
    }

    const hasRelatedDataFeatured = datapageDataFromVar?.relatedData?.some(
        (data) => data.featured
    )
    const hasRelatedDataNonFeatured = datapageDataFromVar?.relatedData?.some(
        (data) => !data.featured
    )
    const relatedDataCategoryClasses = `related-data__category ${
        hasRelatedDataFeatured && hasRelatedDataNonFeatured
            ? "related-data__category--grid span-cols-4 span-lg-cols-6 span-sm-cols-3"
            : "related-data__category--columns span-cols-8 span-lg-cols-12"
    } `

    return (
        <div className="DataPageContent MultiDimDataPageContent">
            <div className="bg-blue-10">
                <div className="header__wrapper wrapper grid grid-cols-12 ">
                    <div className="header__left span-cols-8 span-sm-cols-12">
                        <div className="header__supertitle">Data</div>
                        <h1 className="header__title">
                            {datapageDataFromVar?.title?.title}
                        </h1>
                        <div className="header__source">{titleFragments}</div>
                    </div>
                    {!!topicTagsLinks && (
                        <TopicTags
                            className="header__right col-start-10 span-cols-4 col-sm-start-2 span-sm-cols-12"
                            topicTagsLinks={topicTagsLinks}
                            tagToSlugMap={tagToSlugMap}
                        />
                    )}
                    <div className="settings-row__wrapper span-cols-9 span-sm-cols-12">
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
                                key={JSON.stringify(currentView)}
                                {...grapherConfigComputed}
                                queryStr={queryStr}
                                manager={grapherManager}
                                getGrapherInstance={setGrapherInst}
                            />
                        </figure>
                    </div>
                    {datapageDataFromVar && (
                        <AboutThisData
                            datapageData={datapageDataFromVar}
                            hasFaq={!!faqEntries?.faqs.length}
                        />
                    )}
                </div>
            </div>
            <div className="col-start-2 span-cols-12">
                {relatedResearch && relatedResearch.length > 0 && (
                    <div className="section-wrapper grid">
                        <h2
                            className="related-research__title span-cols-3 span-lg-cols-12"
                            id="research-and-writing"
                        >
                            Related research and writing
                        </h2>
                        <div className="related-research__items grid grid-cols-9 grid-lg-cols-12 span-cols-9 span-lg-cols-12">
                            {relatedResearch.map((research) => (
                                <a
                                    href={research.url}
                                    key={research.url}
                                    className="related-research__item grid grid-cols-4 grid-lg-cols-6 grid-sm-cols-12 span-cols-4 span-lg-cols-6 span-sm-cols-12"
                                >
                                    <DatapageResearchThumbnail
                                        urlOrFilename={research.imageUrl}
                                    />
                                    <div className="span-cols-3 span-lg-cols-4 span-sm-cols-9">
                                        <h3 className="related-article__title">
                                            {research.title}
                                        </h3>
                                        <div className="related-article__authors body-3-medium-italic">
                                            {research.authors &&
                                                research.authors.length &&
                                                formatAuthors({
                                                    authors: research.authors,
                                                })}
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
                {!!datapageDataFromVar?.relatedData?.length && (
                    <div className="section-wrapper grid">
                        <h2
                            className="related-data__title span-cols-3 span-lg-cols-12"
                            id="related-data"
                        >
                            Related data
                        </h2>
                        <div
                            className={cx(
                                "related-data__items",
                                {
                                    "related-data__items--two-cols":
                                        hasRelatedDataFeatured &&
                                        hasRelatedDataNonFeatured,
                                },
                                "grid",
                                "grid-cols-9",
                                "grid-lg-cols-12",
                                "span-cols-9",
                                "span-lg-cols-12"
                            )}
                        >
                            {hasRelatedDataFeatured && (
                                <div className={relatedDataCategoryClasses}>
                                    {datapageDataFromVar.relatedData
                                        .filter((data) => data.featured)
                                        .map((data) => (
                                            <a
                                                href={data.url}
                                                key={data.url}
                                                className="related-data-item related-data-item--medium col-start-1 col-end-limit"
                                            >
                                                {data.type && (
                                                    <div className="related-data-item__type">
                                                        {data.type}
                                                    </div>
                                                )}
                                                <h3 className="related-data-item__title">
                                                    {data.title}
                                                </h3>
                                                {data.source && (
                                                    <div className="related-data-item__source">
                                                        {data.source}
                                                    </div>
                                                )}
                                                <div className="related-data-item__content">
                                                    {data.content}
                                                </div>
                                            </a>
                                        ))}
                                </div>
                            )}
                            {hasRelatedDataNonFeatured && (
                                <div className={relatedDataCategoryClasses}>
                                    {datapageDataFromVar.relatedData
                                        .filter((data) => !data.featured)
                                        .map((data) => (
                                            <a
                                                href={data.url}
                                                key={data.url}
                                                className="related-data-item related-data-item--small col-start-1 col-end-limit"
                                            >
                                                <h4 className="related-data-item__title">
                                                    {data.title}
                                                </h4>
                                                {data.source && (
                                                    <div className="related-data-item__source">
                                                        {data.source}
                                                    </div>
                                                )}
                                            </a>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {datapageDataFromVar?.allCharts &&
                datapageDataFromVar?.allCharts.length > 0 ? (
                    <div className="section-wrapper section-wrapper__related-charts">
                        <h2 className="related-charts__title" id="all-charts">
                            Explore charts that include this data
                        </h2>
                        <div>
                            <RelatedCharts
                                charts={datapageDataFromVar.allCharts}
                            />
                        </div>
                    </div>
                ) : null}
            </div>
            {datapageDataFromVar && (
                <MetadataSection
                    attributionShort={datapageDataFromVar.attributionShort}
                    attributions={datapageDataFromVar.attributions}
                    canonicalUrl={canonicalUrl}
                    descriptionProcessing={
                        datapageDataFromVar.descriptionProcessing
                    }
                    faqEntries={faqEntries}
                    origins={datapageDataFromVar.origins}
                    owidProcessingLevel={
                        datapageDataFromVar.owidProcessingLevel
                    }
                    primaryTopic={datapageDataFromVar.primaryTopic}
                    source={datapageDataFromVar.source}
                    title={datapageDataFromVar.title}
                    titleVariant={datapageDataFromVar.titleVariant}
                />
            )}
        </div>
    )
}

/*
export const MultiDimDataPageContent = ({
    datapageData,
    grapherConfig,
    isPreviewing = false,
    faqEntries,
    canonicalUrl = "{URL}", // when we bake pages to their proper url this will be set correctly but on preview pages we leave this undefined
    tagToSlugMap,
    imageMetadata,
}: DataPageV2ContentFields & {
    grapherConfig: GrapherInterface
    imageMetadata: Record<string, ImageMetadata>
}) => {
    const [grapher, setGrapher] = React.useState<Grapher | undefined>(undefined)

    const titleFragments = joinTitleFragments(
        datapageData.attributionShort,
        datapageData.titleVariant
    )

    // Initialize the grapher for client-side rendering
    const mergedGrapherConfig: GrapherProgrammaticInterface = useMemo(
        () => ({
            ...grapherConfig,
            isEmbeddedInADataPage: true,
            bindUrlToWindow: true,
        }),
        [grapherConfig]
    )

    useEffect(() => {
        setGrapher(new Grapher(mergedGrapherConfig))
    }, [mergedGrapherConfig])

    const stickyNavLinks = [
        {
            text: "Explore the Data",
            target: "#explore-the-data",
        },
        {
            text: "Research & Writing",
            target: "#research-and-writing",
        },
        { text: "Related Data", target: "#related-data" },
        { text: "All Charts", target: "#all-charts" },
        { text: "FAQs", target: "#faqs" },
        {
            text: "Sources & Processing",
            target: "#" + DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
        },
        { text: "Reuse This Work", target: "#" + REUSE_THIS_WORK_SECTION_ID },
    ]

    const hasRelatedDataFeatured = datapageData.relatedData?.some(
        (data) => data.featured
    )
    const hasRelatedDataNonFeatured = datapageData.relatedData?.some(
        (data) => !data.featured
    )
    const relatedDataCategoryClasses = `related-data__category ${
        hasRelatedDataFeatured && hasRelatedDataNonFeatured
            ? "related-data__category--grid span-cols-4 span-lg-cols-6 span-sm-cols-3"
            : "related-data__category--columns span-cols-8 span-lg-cols-12"
    } `

    const hasDescriptionKey =
        datapageData.descriptionKey && datapageData.descriptionKey.length > 0

    const sourcesForDisplay = prepareSourcesForDisplay(datapageData)
    const getYearSuffixFromOrigin = (o: OwidOrigin) => {
        const year = o.dateAccessed
            ? dayjs(o.dateAccessed, ["YYYY-MM-DD", "YYYY"]).year()
            : o.datePublished
              ? dayjs(o.datePublished, ["YYYY-MM-DD", "YYYY"]).year()
              : undefined
        if (year) return ` (${year})`
        else return ""
    }
    const producers = uniq(datapageData.origins.map((o) => `${o.producer}`))
    const producersWithYear = uniq(
        datapageData.origins.map(
            (o) => `${o.producer}${getYearSuffixFromOrigin(o)}`
        )
    )

    const attributionFragments = datapageData.attributions ?? producersWithYear
    const attributionUnshortened = attributionFragments.join("; ")
    const citationShort = getCitationShort(
        datapageData.origins,
        datapageData.attributions,
        datapageData.owidProcessingLevel
    )
    const currentYear = dayjs().year()
    const citationLong = getCitationLong(
        datapageData.title,
        datapageData.origins,
        datapageData.source,
        datapageData.attributions,
        datapageData.attributionShort,
        datapageData.titleVariant,
        datapageData.owidProcessingLevel,
        canonicalUrl
    )

    const adaptedFrom =
        producers.length > 0 ? producers.join(", ") : datapageData.source?.name

    const maybeAddPeriod = (s: string) =>
        s.endsWith("?") || s.endsWith(".") ? s : `${s}.`

    // For the citation of the data page add a period it doesn't have that or a question mark
    const primaryTopicCitation = maybeAddPeriod(
        datapageData.primaryTopic?.citation ?? ""
    )

    const citationDatapage = excludeUndefined([
        datapageData.primaryTopic
            ? `“Data Page: ${datapageData.title.title}”, part of the following publication: ${primaryTopicCitation}`
            : `“Data Page: ${datapageData.title.title}”. Our World in Data (${currentYear}).`,
        adaptedFrom ? `Data adapted from ${adaptedFrom}.` : undefined,
        `Retrieved from ${canonicalUrl} [online resource]`,
    ]).join(" ")

    const relatedResearchCandidates = datapageData.relatedResearch
    const relatedResearch =
        relatedResearchCandidates.length > 3 &&
        datapageData.topicTagsLinks?.length
            ? relatedResearchCandidates.filter((research) => {
                  const shared = intersection(
                      research.tags,
                      datapageData.topicTagsLinks ?? []
                  )
                  return shared.length > 0
              })
            : relatedResearchCandidates
    for (const item of relatedResearch) {
        // TODO: these are workarounds to not link to the (not really existing) template pages for energy or co2
        // country profiles but instead to the topic page at the country selector.
        if (item.url === "/co2-country-profile")
            item.url =
                "/co2-and-greenhouse-gas-emissions#co2-and-greenhouse-gas-emissions-country-profiles"
        else if (item.url === "/energy-country-profile")
            item.url = "/energy#country-profiles"
        else if (item.url === "/coronavirus-country-profile")
            item.url = "/coronavirus#coronavirus-country-profiles"
    }
    // TODO: mark topic pages

    const topicTags = datapageData.topicTagsLinks
        ?.map((name) => ({ name, slug: tagToSlugMap[name] }))
        .filter((tag): tag is { name: string; slug: string } => !!tag.slug)
        .map((tag) => (
            <a href={`/${tag.slug}`} key={tag.slug}>
                {tag.name}
            </a>
        ))

    return (
        <AttachmentsContext.Provider
            value={{
                linkedDocuments: {},
                imageMetadata,
                linkedCharts: {},
                linkedIndicators: {},
                relatedCharts: [],
            }}
        >
            <DocumentContext.Provider value={{ isPreviewing }}>
                <div className="DataPageContent__grapher-for-embed">
                    <GrapherWithFallback
                        grapher={grapher}
                        slug={grapherConfig.slug}
                    />
                </div>
                <div className="DataPageContent">
                    <div className="bg-blue-10">
                        <div className="header__wrapper wrapper grid grid-cols-12 ">
                            <div className="header__left span-cols-8 span-sm-cols-12">
                                <div className="header__supertitle">Data</div>
                                <h1 className="header__title">
                                    {datapageData.title.title}
                                </h1>
                                <div className="header__source">
                                    {titleFragments}
                                </div>
                            </div>
                            {!!datapageData.topicTagsLinks?.length && (
                                <div className="header__right col-start-9 span-cols-4 span-sm-cols-12">
                                    <div className="topic-tags__label">
                                        See all data and research on:
                                    </div>
                                    <div className="topic-tags">
                                        {topicTags}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <nav className="sticky-nav sticky-nav--dark">
                        <StickyNav links={stickyNavLinks} className="wrapper" />
                    </nav>
                    <div className="chart-key-info">
                        <GrapherWithFallback
                            grapher={grapher}
                            slug={grapherConfig.slug} // TODO: On grapher pages,
                            // there will always be a slug, but if we just show a data page preview for an indicator in the admin, there will be no slug
                            // and then thumbnails will be broken for those. When we consider baking data pages for
                            // non-grapher pages then we need to make sure that there are thunbnails that are generated for the these non-chart graphers and
                            // then this piece will have to change anyhow and know how to provide the thumbnail.
                            className="wrapper"
                            id="explore-the-data"
                        />
                        <div className="wrapper wrapper-about-this-data grid grid-cols-12">
                            {hasDescriptionKey ||
                            datapageData.descriptionFromProducer ||
                            datapageData.source?.additionalInfo ? (
                                <>
                                    <h2
                                        id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                                        className="key-info__title span-cols-12"
                                    >
                                        What you should know about this
                                        indicator
                                    </h2>
                                    <div className="col-start-1 span-cols-8 span-lg-cols-7 span-sm-cols-12">
                                        <div className="key-info__content">
                                            {hasDescriptionKey && (
                                                <div className="key-info__key-description">
                                                    {datapageData.descriptionKey
                                                        .length === 1 ? (
                                                        <SimpleMarkdownText
                                                            text={datapageData.descriptionKey[0].trim()}
                                                        />
                                                    ) : (
                                                        <ul>
                                                            {datapageData.descriptionKey.map(
                                                                (text, i) => (
                                                                    <li key={i}>
                                                                        <SimpleMarkdownText
                                                                            text={text.trim()}
                                                                            useParagraphs={
                                                                                false
                                                                            }
                                                                        />
                                                                    </li>
                                                                )
                                                            )}
                                                        </ul>
                                                    )}
                                                    {!!faqEntries?.faqs
                                                        .length && (
                                                        <a
                                                            className="key-info__learn-more"
                                                            href="#faqs"
                                                        >
                                                            Learn more in the
                                                            FAQs
                                                            <FontAwesomeIcon
                                                                icon={
                                                                    faArrowDown
                                                                }
                                                            />
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            <div className="key-info__expandable-descriptions">
                                                {datapageData.descriptionFromProducer && (
                                                    <ExpandableToggle
                                                        label={
                                                            datapageData.attributionShort
                                                                ? `How does the producer of this data - ${datapageData.attributionShort} - describe this data?`
                                                                : "How does the producer of this data describe this data?"
                                                        }
                                                        content={
                                                            <div className="article-block__text">
                                                                <SimpleMarkdownText
                                                                    text={
                                                                        datapageData.descriptionFromProducer
                                                                    }
                                                                />
                                                            </div>
                                                        }
                                                        isStacked={
                                                            !!datapageData
                                                                .source
                                                                ?.additionalInfo
                                                        }
                                                    />
                                                )}
                                                {datapageData.source
                                                    ?.additionalInfo && (
                                                    <ExpandableToggle
                                                        label="Additional information about this data"
                                                        content={
                                                            <div className="expandable-info-blocks__content">
                                                                <HtmlOrSimpleMarkdownText
                                                                    text={datapageData.source?.additionalInfo.trim()}
                                                                />
                                                            </div>
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="key-info__right span-cols-4 span-lg-cols-5 span-sm-cols-12">
                                        <KeyDataTable
                                            datapageData={datapageData}
                                            attribution={attributionUnshortened}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h2
                                        className="about-this-data__title span-cols-3 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                        id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                                    >
                                        About this data
                                    </h2>
                                    <div className="col-start-4 span-cols-10 col-lg-start-5 span-lg-cols-8 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        <KeyDataTable
                                            datapageData={datapageData}
                                            attribution={attributionUnshortened}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="wrapper">
                        {relatedResearch && relatedResearch.length > 0 && (
                            <div className="section-wrapper grid">
                                <h2
                                    className="related-research__title span-cols-3 span-lg-cols-12"
                                    id="research-and-writing"
                                >
                                    Related research and writing
                                </h2>
                                <div className="related-research__items grid grid-cols-9 grid-lg-cols-12 span-cols-9 span-lg-cols-12">
                                    {relatedResearch.map((research) => (
                                        <a
                                            href={research.url}
                                            key={research.url}
                                            className="related-research__item grid grid-cols-4 grid-lg-cols-6 grid-sm-cols-12 span-cols-4 span-lg-cols-6 span-sm-cols-12"
                                        >
                                            <DatapageResearchThumbnail
                                                urlOrFilename={
                                                    research.imageUrl
                                                }
                                            />
                                            <div className="span-cols-3 span-lg-cols-4 span-sm-cols-9">
                                                <h3 className="related-article__title">
                                                    {research.title}
                                                </h3>
                                                <div className="related-article__authors body-3-medium-italic">
                                                    {research.authors &&
                                                        research.authors
                                                            .length &&
                                                        formatAuthors({
                                                            authors:
                                                                research.authors,
                                                        })}
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                        {!!datapageData.relatedData?.length && (
                            <div className="section-wrapper grid">
                                <h2
                                    className="related-data__title span-cols-3 span-lg-cols-12"
                                    id="related-data"
                                >
                                    Related data
                                </h2>
                                <div
                                    className={cx(
                                        "related-data__items",
                                        {
                                            "related-data__items--two-cols":
                                                hasRelatedDataFeatured &&
                                                hasRelatedDataNonFeatured,
                                        },
                                        "grid",
                                        "grid-cols-9",
                                        "grid-lg-cols-12",
                                        "span-cols-9",
                                        "span-lg-cols-12"
                                    )}
                                >
                                    {hasRelatedDataFeatured && (
                                        <div
                                            className={
                                                relatedDataCategoryClasses
                                            }
                                        >
                                            {datapageData.relatedData
                                                .filter((data) => data.featured)
                                                .map((data) => (
                                                    <a
                                                        href={data.url}
                                                        key={data.url}
                                                        className="related-data-item related-data-item--medium col-start-1 col-end-limit"
                                                    >
                                                        {data.type && (
                                                            <div className="related-data-item__type">
                                                                {data.type}
                                                            </div>
                                                        )}
                                                        <h3 className="related-data-item__title">
                                                            {data.title}
                                                        </h3>
                                                        {data.source && (
                                                            <div className="related-data-item__source">
                                                                {data.source}
                                                            </div>
                                                        )}
                                                        <div className="related-data-item__content">
                                                            {data.content}
                                                        </div>
                                                    </a>
                                                ))}
                                        </div>
                                    )}
                                    {hasRelatedDataNonFeatured && (
                                        <div
                                            className={
                                                relatedDataCategoryClasses
                                            }
                                        >
                                            {datapageData.relatedData
                                                .filter(
                                                    (data) => !data.featured
                                                )
                                                .map((data) => (
                                                    <a
                                                        href={data.url}
                                                        key={data.url}
                                                        className="related-data-item related-data-item--small col-start-1 col-end-limit"
                                                    >
                                                        <h4 className="related-data-item__title">
                                                            {data.title}
                                                        </h4>
                                                        {data.source && (
                                                            <div className="related-data-item__source">
                                                                {data.source}
                                                            </div>
                                                        )}
                                                    </a>
                                                ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {datapageData.allCharts &&
                        datapageData.allCharts.length > 0 ? (
                            <div className="section-wrapper section-wrapper__related-charts">
                                <h2
                                    className="related-charts__title"
                                    id="all-charts"
                                >
                                    Explore charts that include this data
                                </h2>
                                <div>
                                    <RelatedCharts
                                        charts={datapageData.allCharts}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <div className="bg-gray-10">
                        <div className="wrapper">
                            {!!faqEntries?.faqs.length && (
                                <div className="section-wrapper section-wrapper__faqs grid">
                                    <h2
                                        className="faqs__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                        id="faqs"
                                    >
                                        Frequently Asked Questions
                                    </h2>
                                    <div className="faqs__items grid grid-cols-10 grid-lg-cols-9 grid-md-cols-12 span-cols-10 span-lg-cols-9 span-md-cols-12 span-sm-cols-12">
                                        <ArticleBlocks
                                            blocks={faqEntries.faqs}
                                            containerType="datapage"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="section-wrapper grid">
                                <h2
                                    className="data-sources-processing__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                    id={
                                        DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID
                                    }
                                >
                                    Sources and processing
                                </h2>
                                <div className="data-sources grid span-cols-12">
                                    <h3 className="data-sources__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        This data is based on the following
                                        sources
                                    </h3>
                                    <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        <IndicatorSources
                                            sources={sourcesForDisplay}
                                        />
                                    </div>
                                </div>
                                <div className="data-processing grid span-cols-12">
                                    <h3 className="data-processing__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        How we process data at Our World in Data
                                    </h3>
                                    <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                        <IndicatorProcessing
                                            descriptionProcessing={
                                                datapageData.descriptionProcessing
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="section-wrapper grid">
                                <h2
                                    className="reuse__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                    id="reuse-this-work"
                                >
                                    Reuse this work
                                </h2>
                                <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                    <ul className="reuse__content">
                                        <li className="reuse__list-item">
                                            All data produced by third-party
                                            providers and made available by Our
                                            World in Data are subject to the
                                            license terms from the original
                                            providers. Our work would not be
                                            possible without the data providers
                                            we rely on, so we ask you to always
                                            cite them appropriately (see below).
                                            This is crucial to allow data
                                            providers to continue doing their
                                            work, enhancing, maintaining and
                                            updating valuable data.
                                        </li>
                                        <li className="reuse__list-item">
                                            All data, visualizations, and code
                                            produced by Our World in Data are
                                            completely open access under the{" "}
                                            <a
                                                href="https://creativecommons.org/licenses/by/4.0/"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="reuse__link"
                                            >
                                                Creative Commons BY license
                                            </a>
                                            . You have the permission to use,
                                            distribute, and reproduce these in
                                            any medium, provided the source and
                                            authors are credited.
                                        </li>
                                    </ul>
                                </div>

                                {(citationShort ||
                                    citationLong ||
                                    citationDatapage) && (
                                    <div className="citations grid span-cols-12">
                                        <h3 className="citations__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                            Citations
                                        </h3>
                                        <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                                            {citationDatapage && (
                                                <div className="citations-section">
                                                    <h5 className="citation__how-to-header">
                                                        How to cite this page
                                                    </h5>
                                                    <p className="citation__paragraph">
                                                        To cite this page
                                                        overall, including any
                                                        descriptions, FAQs or
                                                        explanations of the data
                                                        authored by Our World in
                                                        Data, please use the
                                                        following citation:
                                                    </p>
                                                    <CodeSnippet
                                                        code={citationDatapage}
                                                        theme="light"
                                                        useMarkdown={true}
                                                    />
                                                </div>
                                            )}
                                            <div className="citations-section">
                                                <h5 className="citation__how-to-header citation__how-to-header--data">
                                                    How to cite this data
                                                </h5>
                                                {(citationShort ||
                                                    citationLong) && (
                                                    <DataCitation
                                                        citationLong={
                                                            citationLong
                                                        }
                                                        citationShort={
                                                            citationShort
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </DocumentContext.Provider>
        </AttachmentsContext.Provider>
    )
}
*/

export const hydrateMultiDimDataPageContent = (isPreviewing?: boolean) => {
    const wrapper = document.querySelector(`#${OWID_DATAPAGE_CONTENT_ROOT_ID}`)
    const props: DataPageV2ContentFields = window._OWID_DATAPAGEV2_PROPS
    const grapherConfig = window._OWID_GRAPHER_CONFIG
    const initialQueryStr = getWindowQueryStr()
    const config = MultiDimDataPageConfig.fromObject(
        window._OWID_MULTI_DIM_CONFIG
    )

    ReactDOM.hydrate(
        <DebugProvider debug={isPreviewing}>
            <MultiDimDataPageContent
                {...props}
                config={config}
                grapherConfig={grapherConfig}
                isPreviewing={isPreviewing}
                initialQueryStr={initialQueryStr}
            />
        </DebugProvider>,
        wrapper
    )
}
