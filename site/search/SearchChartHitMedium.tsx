import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useIntersectionObserver } from "usehooks-ts"
import cx from "classnames"
import { Region } from "@ourworldindata/utils"
import { ChartRecordType, SearchChartHit } from "./searchTypes.js"
import {
    constructChartUrl,
    constructConfigUrl,
    constructThumbnailUrl,
    fetchJson,
    pickEntitiesForChartHit,
    getSortedGrapherTabsForChartHit,
    buildChartHitDataDisplayProps,
    constructChartInfoUrl,
    toGrapherQueryParams,
    getTimeBoundsForChartUrl,
} from "./searchUtils.js"
import { DATA_API_URL } from "../../settings/clientSettings.js"
import {
    GrapherState,
    migrateGrapherConfigToLatestVersion,
    fetchInputTableForConfig,
    WORLD_ENTITY_NAME,
    constructGrapherValuesJson,
    mapGrapherTabNameToConfigOption,
    makeLabelForGrapherTab,
    ChartSeries,
    mapGrapherTabNameToQueryParam,
    CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME,
} from "@ourworldindata/grapher"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"
import {
    GrapherInterface,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    GrapherChartType,
    GrapherValuesJson,
} from "@ourworldindata/types"
import { chartHitQueryKeys } from "./queries.js"
import { SearchChartHitThumbnail } from "./SearchChartHitThumbnail.js"
import { SearchChartHitDataDisplay } from "./SearchChartHitDataDisplay.js"
import { SearchChartHitTable } from "./SearchChartHitTable.js"

interface SearchChartHitMediumProps {
    hit: SearchChartHit
    searchQueryRegionsMatches?: Region[] | undefined
    // Search uses a global onClick handler to track analytics
    // But the data catalog passes a function to this component explicitly
    onClick?: () => void
}

enum SearchChartHitMediumGridSlot {
    SingleSlot = "single-slot",
    DoubleSlot = "double-slot",
    SmallSlotLeft = "small-slot-left",
    SmallSlotRight = "small-slot-right",
}

export function SearchChartHitMedium(
    props: SearchChartHitMediumProps
): React.ReactElement {
    // Explorers don't yet support rich data display
    const isExplorerView = props.hit.type === ChartRecordType.ExplorerView
    return isExplorerView ? (
        <SearchChartHitMediumFallback {...props} />
    ) : (
        <SearchChartHitMediumRichData {...props} />
    )
}

function SearchChartHitMediumRichData({
    hit,
    searchQueryRegionsMatches,
    onClick,
}: SearchChartHitMediumProps) {
    // Intersection observer for lazy loading config and data
    const { ref, isIntersecting: hasBeenVisible } = useIntersectionObserver({
        rootMargin: "400px", // Start loading 400px before visible
        freezeOnceVisible: true, // Only trigger once
    })

    const pickedEntities = useMemo(
        () => pickEntitiesForChartHit(hit, searchQueryRegionsMatches),
        [hit, searchQueryRegionsMatches]
    )

    // Fetch the grapher config
    const { data: fetchedChartConfig, status: loadingStatusConfig } = useQuery({
        queryKey: chartHitQueryKeys.chartConfig(hit.slug, hit.queryParams),
        queryFn: () => {
            const configUrl = constructConfigUrl({ hit })
            if (!configUrl) return null
            return fetchJson<GrapherInterface>(configUrl)
        },
        // Only fetch when the component is visible
        enabled: hasBeenVisible,
    })
    const chartConfig = fetchedChartConfig
        ? migrateGrapherConfigToLatestVersion(fetchedChartConfig)
        : undefined

    // Fetch chart data and metadata
    const { data: inputTable, status: loadingStatusData } = useQuery({
        queryKey: chartHitQueryKeys.chartData(hit.slug, hit.queryParams),
        queryFn: () =>
            fetchInputTableForConfig({
                dimensions: chartConfig!.dimensions,
                selectedEntityColors: chartConfig!.selectedEntityColors,
                dataApiUrl: DATA_API_URL,
            }),
        // Only fetch when the config is available
        enabled: hasBeenVisible && !!chartConfig,
    })

    // Render the fallback component if config or data loading failed
    if (loadingStatusConfig === "error" || loadingStatusData === "error") {
        return (
            <SearchChartHitMediumFallback
                hit={hit}
                searchQueryRegionsMatches={searchQueryRegionsMatches}
                onClick={onClick}
            />
        )
    }

    // Render a placeholder component while the config and data are loading
    // to prevent layout shifts and flashing content
    if (
        loadingStatusConfig === "loading" ||
        loadingStatusData === "loading" ||
        !chartConfig ||
        !inputTable
    ) {
        const entityParam = toGrapherQueryParams({ entities: pickedEntities })
        const chartUrl = constructChartUrl({ hit, grapherParams: entityParam })

        return (
            <div ref={ref} className="search-chart-hit-medium">
                <SearchChartHitHeader
                    hit={hit}
                    url={chartUrl}
                    onClick={onClick}
                />

                <div className="search-chart-hit-medium__content">
                    <GrapherThumbnailPlaceholder />
                    <GrapherThumbnailPlaceholder />
                    <GrapherThumbnailPlaceholder />
                </div>
            </div>
        )
    }

    // Init the grapher state and update its data
    const grapherState = new GrapherState(chartConfig)
    grapherState.inputTable = inputTable

    // If the user hasn't selected any entities, use the first four entities
    // of the chart selected by default
    const entities =
        pickedEntities.length > 0
            ? pickedEntities
            : grapherState.selection.selectedEntityNames.slice(0, 4)

    // Prepare rendering the data display
    const defaultEntityForDisplay =
        // Displaying a data value for World doesn't make sense when we're plotting
        // columns and the currently selected entity isn't World
        grapherState.chartState.seriesStrategy === SeriesStrategy.column &&
        grapherState.selection.selectedEntityNames[0] !== WORLD_ENTITY_NAME
            ? undefined
            : WORLD_ENTITY_NAME
    const entityForDisplay = pickedEntities[0] ?? defaultEntityForDisplay
    const chartInfo = entityForDisplay
        ? constructGrapherValuesJson(grapherState, entityForDisplay)
        : undefined
    const dataDisplayProps = buildChartHitDataDisplayProps({
        chartInfo,
        chartType: grapherState.chartType,
        entity: entityForDisplay,
        isEntityPickedByUser: pickedEntities.length > 0,
    })

    // Find Grapher tabs to display and bring them in the right order
    const sortedTabs = getSortedGrapherTabsForChartHit(grapherState)

    // Update the GrapherState before rendering the tab previews:
    // - Set the active tab to match the first tab we'll render
    // - Update the selected entities to match the ones we determined for this search result
    if (sortedTabs.length > 0)
        grapherState.tab = mapGrapherTabNameToConfigOption(sortedTabs[0])
    if (entities.length > 0)
        grapherState.selection.setSelectedEntities(entities)

    // It's possible that the first tab is a line or slope chart with a single
    // time selected by default. In this case, the active tab (DiscreteBar)
    // doesn't match the first tab we'll render (LineChart). To switch to the
    // line chart, ensure that the handles are on different times.
    if (sortedTabs[0] !== grapherState.activeTab) {
        grapherState.ensureTimeHandlesAreSensibleForTab(sortedTabs[0])
    }

    const entityParam = toGrapherQueryParams({ entities })
    const chartUrl = constructChartUrl({ hit, grapherParams: entityParam })

    return (
        <div ref={ref} className="search-chart-hit-medium">
            <SearchChartHitHeader
                hit={hit}
                url={chartUrl}
                source={grapherState.sourcesLine}
                onClick={onClick}
            />

            <div className="search-chart-hit-medium__content">
                {sortedTabs.map((tab, index) => {
                    const slot = findSlotForGrapherTab(sortedTabs, index, {
                        hasDataDisplay: !!dataDisplayProps,
                        chartSeries: grapherState.chartState.series,
                    })

                    return (
                        <GrapherTabPreview
                            key={tab}
                            hit={hit}
                            tab={tab}
                            grapherState={grapherState}
                            slot={slot}
                            onClick={onClick}
                        />
                    )
                })}

                {dataDisplayProps && (
                    <SearchChartHitDataDisplay
                        className="data-slot"
                        {...dataDisplayProps}
                    />
                )}
            </div>
        </div>
    )
}

function SearchChartHitMediumFallback({
    hit,
    searchQueryRegionsMatches,
    onClick,
}: SearchChartHitMediumProps) {
    // Intersection observer for lazy loading chart info
    const { ref, isIntersecting: hasBeenVisible } = useIntersectionObserver({
        rootMargin: "400px", // Start loading 400px before visible
        freezeOnceVisible: true, // Only trigger once
    })

    const entities = useMemo(
        () => pickEntitiesForChartHit(hit, searchQueryRegionsMatches),
        [hit, searchQueryRegionsMatches]
    )

    const entityForDisplay = entities[0] ?? WORLD_ENTITY_NAME
    const hasUserPickedEntities = entities.length > 0

    const entityParam = toGrapherQueryParams({ entities })
    const chartUrl = constructChartUrl({ hit, grapherParams: entityParam })

    // Fetch chart info and data values
    const { data: chartInfo } = useQuery({
        queryKey: chartHitQueryKeys.chartInfo(hit.slug, entities),
        queryFn: () => {
            const url = constructChartInfoUrl({
                hit,
                grapherParams: entityParam,
            })
            if (!url) return null
            return fetchJson<GrapherValuesJson>(url)
        },
        // Only fetch when the component is visible
        enabled: hasBeenVisible,
    })

    // The first chart tab is the 'primary' chart type
    const chartType: GrapherChartType | undefined = hit.availableTabs.find(
        (tab) =>
            tab !== GRAPHER_TAB_NAMES.Table &&
            tab !== GRAPHER_TAB_NAMES.WorldMap
    )

    const dataDisplayProps = buildChartHitDataDisplayProps({
        chartInfo,
        chartType,
        entity: entityForDisplay,
        isEntityPickedByUser: hasUserPickedEntities,
    })

    const availableGrapherTabs = hit.availableTabs.filter(
        (tab) => tab !== GRAPHER_TAB_NAMES.Table
    )
    const numAvailableGridSlots = dataDisplayProps ? 3 : 4
    const grapherTabs = availableGrapherTabs.slice(0, numAvailableGridSlots)

    return (
        <div ref={ref} className="search-chart-hit-medium">
            <SearchChartHitHeader
                hit={hit}
                url={chartUrl}
                source={chartInfo?.source}
                onClick={onClick}
            />

            <div className="search-chart-hit-medium__content">
                {grapherTabs.map((tab, index) => {
                    const slot: SearchChartHitMediumGridSlot =
                        index < 3
                            ? SearchChartHitMediumGridSlot.SingleSlot
                            : index === 3
                              ? SearchChartHitMediumGridSlot.SmallSlotLeft
                              : SearchChartHitMediumGridSlot.SmallSlotRight

                    const caption = makeLabelForGrapherTab(tab, {
                        format: "long",
                    })

                    // Single-time line charts are rendered as bar charts
                    // by Grapher. Adjusting the time param makes sure
                    // Grapher actually shows a line chart. This is important
                    // since we offer separate links for going to the line
                    // chart view and the bar chart view. If we didn't do
                    // this, both links would end up going to the bar chart.
                    const timeParam =
                        CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME.includes(
                            tab as any
                        )
                            ? getTimeBoundsForChartUrl(chartInfo)
                            : undefined
                    const grapherParams = toGrapherQueryParams({
                        entities,
                        tab,
                        ...timeParam,
                    })

                    const chartUrl = constructChartUrl({
                        hit,
                        grapherParams,
                    })
                    const previewUrl = constructThumbnailUrl({
                        hit,
                        grapherParams,
                    })

                    return (
                        <CaptionedLink
                            key={tab}
                            caption={caption}
                            url={chartUrl}
                            className={slot}
                            onClick={onClick}
                        >
                            <SearchChartHitThumbnail previewUrl={previewUrl} />
                        </CaptionedLink>
                    )
                })}

                {dataDisplayProps && (
                    <SearchChartHitDataDisplay
                        className="data-slot"
                        {...dataDisplayProps}
                    />
                )}
            </div>
        </div>
    )
}

function GrapherTabPreview({
    hit,
    tab,
    grapherState,
    slot,
    onClick,
}: {
    hit: SearchChartHit
    tab: GrapherTabName
    grapherState: GrapherState
    slot: SearchChartHitMediumGridSlot
    onClick?: () => void
}): React.ReactElement {
    // Use Grapher's changedParams to construct chart and preview URLs.
    // We override the tab parameter because the GrapherState is currently set to
    // the first tab of the chart, but we need to generate URLs for the specific
    // tab being rendered in this preview.
    const grapherParams = {
        ...grapherState.changedParams,
        tab: mapGrapherTabNameToQueryParam(tab),
    }
    const chartUrl = constructChartUrl({ hit, grapherParams })
    const previewUrl = constructThumbnailUrl({ hit, grapherParams })

    // Construct caption
    const numAvailableEntities = grapherState.availableEntityNames.length
    const tableCaption =
        numAvailableEntities === 1
            ? `Data available for ${numAvailableEntities} ${grapherState.entityType}`
            : `Data available for ${numAvailableEntities} ${grapherState.entityTypePlural}`
    const chartCaption = makeLabelForGrapherTab(tab, { format: "long" })
    const isTableTab = tab === GRAPHER_TAB_NAMES.Table
    const caption = isTableTab ? tableCaption : chartCaption

    // If two slots are available to us, we can show more rows
    const maxRows = slot === "double-slot" ? 8 : 4

    return (
        <CaptionedLink
            caption={caption}
            url={chartUrl}
            className={slot}
            onClick={onClick}
        >
            {isTableTab ? (
                <SearchChartHitTable
                    grapherState={grapherState}
                    maxRows={maxRows}
                />
            ) : (
                <SearchChartHitThumbnail previewUrl={previewUrl} />
            )}
        </CaptionedLink>
    )
}

function CaptionedLink({
    url,
    className,
    onClick,
    children,
    caption,
}: {
    url: string
    className?: string
    onClick?: () => void
    children: React.ReactNode
    caption: string
}): React.ReactElement {
    return (
        <a
            href={url}
            className={cx("search-chart-hit-medium__captioned-link", className)}
            onClick={onClick}
        >
            {children}
            <div className="search-chart-hit-medium__captioned-link-label">
                {caption}
            </div>
        </a>
    )
}

function GrapherThumbnailPlaceholder(): React.ReactElement {
    return (
        <div className="search-chart-hit-medium__skeleton single-slot">
            <div className="search-chart-hit-medium__placeholder" />
            <div className="search-chart-hit-medium__captioned-link-label">
                Chart
            </div>
        </div>
    )
}

function findSlotForGrapherTab(
    grapherTabs: GrapherTabName[],
    index: number,
    {
        hasDataDisplay,
        chartSeries,
    }: { hasDataDisplay: boolean; chartSeries: readonly ChartSeries[] }
): SearchChartHitMediumGridSlot {
    // Tabs at array indices 3 and 4 (positions 4 and 5) are placed in
    // smaller slots below the data display
    if (index === 3) return SearchChartHitMediumGridSlot.SmallSlotLeft
    if (index === 4) return SearchChartHitMediumGridSlot.SmallSlotRight

    // Check if the table tab can stretch two slots
    const currentTab = grapherTabs[index]
    const isTableTab = currentTab === GRAPHER_TAB_NAMES.Table
    const grapherHasSufficientDataForWideTable = chartSeries.length > 4
    const gridHasSufficientSpaceForDoubleSlot =
        grapherTabs.length <= 2 || (grapherTabs.length <= 3 && !hasDataDisplay)
    if (
        isTableTab &&
        grapherHasSufficientDataForWideTable &&
        gridHasSufficientSpaceForDoubleSlot
    )
        return SearchChartHitMediumGridSlot.DoubleSlot

    return SearchChartHitMediumGridSlot.SingleSlot
}
