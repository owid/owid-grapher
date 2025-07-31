import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useIntersectionObserver } from "usehooks-ts"
import cx from "classnames"
import * as R from "remeda"
import { findClosestTime, Region } from "@ourworldindata/utils"
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
    placeGrapherTabsInGridLayout,
    GridSlot,
    getRowCountForGridSlot,
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
    EntityName,
    FacetStrategy,
    SeriesStrategy,
    EntitySelectionMode,
} from "@ourworldindata/types"
import { chartHitQueryKeys } from "./queries.js"
import { SearchChartHitThumbnail } from "./SearchChartHitThumbnail.js"
import { SearchChartHitDataDisplay } from "./SearchChartHitDataDisplay.js"
import { buildChartHitDataTableProps } from "./SearchChartHitDataTableHelpers.js"
import { SearchChartHitDataTable } from "./SearchChartHitDataTable.js"
import { match } from "ts-pattern"

const NUM_DATA_TABLE_ROWS_PER_COLUMN = 4

interface SearchChartHitMediumProps {
    hit: SearchChartHit
    searchQueryRegionsMatches?: Region[] | undefined
    // Search uses a global onClick handler to track analytics
    // But the data catalog passes a function to this component explicitly
    onClick?: () => void
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

    // If the user hasn't picked any entities, use the default ones
    const entities = pickEntitiesForDisplay({ grapherState, pickedEntities })

    // Find Grapher tabs to display and bring them in the right order
    const sortedTabs = getSortedGrapherTabsForChartHit(grapherState)
    const primaryTab = sortedTabs[0]

    // Update the GrapherState before rendering the tab previews,
    // so that the active tab matches the first tab we'll render
    grapherState.tab = mapGrapherTabNameToConfigOption(primaryTab)

    // When a line or slope chart has only a single time point selected by default,
    // Grapher automatically switches to a discrete bar chart. This means the active
    // tab type (DiscreteBar) wouldn't match what we want to render in the preview
    // (LineChart). By ensuring the time handles are on different times, we force
    // Grapher to display the actual line/slope chart instead of a bar chart.
    grapherState.ensureTimeHandlesAreSensibleForTab(primaryTab)

    // Update the selected entities to match the ones we determined for this
    // search result, and update the focused entities to match the ones the
    // user picked
    if (entities.length > 0)
        grapherState.selection.setSelectedEntities(entities)
    if (
        pickedEntities.length > 0 &&
        // focusing entities only makes sense when we're plotting entities
        grapherState.chartState.seriesStrategy === SeriesStrategy.entity &&
        grapherState.facetStrategy !== FacetStrategy.entity
    ) {
        const pickedAndSelectedEntities = pickedEntities.filter((entity) =>
            grapherState.selection.selectedSet.has(entity)
        )
        grapherState.focusArray.clearAllAndAdd(...pickedAndSelectedEntities)
    } else {
        // Clear the focus state for any entities that might be focused by default
        grapherState.focusArray.clear()
    }

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

    // Figure out the layout by assigning each Grapher tab to grid slots.
    // The table tab can optionally span two or more slots (instead of just one)
    // if there's enough space in the grid and enough data to justify it.
    // Since this decision depends on the table content, we need to
    // build the table props first to get the row count.
    const dataTableProps = buildChartHitDataTableProps({ grapherState })
    const placedTabs = placeGrapherTabsInGridLayout(sortedTabs, {
        numDataTableRows: dataTableProps.rows.length,
        hasDataDisplay: !!dataDisplayProps,
        numDataTableRowsPerColumn: NUM_DATA_TABLE_ROWS_PER_COLUMN,
    })

    // Check how much many rows are available for the table and update
    // the selected/focused entities accordingly. This is important to ensure
    // that the table and thumbnail display the same entities/series.
    const tableSlot = placedTabs.find(
        ({ tab }) => tab === GRAPHER_TAB_NAMES.Table
    )?.slot
    if (tableSlot && !grapherState.isFaceted) {
        const numAvailableRows = getRowCountForGridSlot(
            tableSlot,
            NUM_DATA_TABLE_ROWS_PER_COLUMN
        )
        const selectedEntities = grapherState.selection.selectedEntityNames
        if (
            grapherState.chartState.seriesStrategy === SeriesStrategy.entity &&
            selectedEntities.length > numAvailableRows
        ) {
            // When plotting entities as series, limit the selection to only
            // those that can be displayed in the table rows to ensure
            // thumbnails and table show the same data
            grapherState.selection.setSelectedEntities(
                selectedEntities.slice(0, numAvailableRows)
            )
        } else if (
            grapherState.yColumnSlugs.length > numAvailableRows &&
            !grapherState.hasProjectedData
        ) {
            // When plotting columns as series, focus only the subset of columns
            // that can be displayed in the table to ensure thumbnails and table
            // show the same data
            const seriesNamesInTable = dataTableProps.rows
                .slice(0, numAvailableRows)
                .map((row) => row.name)
            grapherState.focusArray.clearAllAndAdd(...seriesNamesInTable)
        }
    }

    // Reset the persisted color map to make sure the data table
    // and thumbnails use the some colors for the same entities
    grapherState.seriesColorMap?.clear()

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
                {placedTabs.map(({ tab, slot }) =>
                    tab === GRAPHER_TAB_NAMES.Table ? (
                        <CaptionedTable
                            key={tab}
                            hit={hit}
                            tab={tab}
                            slot={slot}
                            grapherState={grapherState}
                            onClick={onClick}
                        />
                    ) : (
                        <CaptionedThumbnail
                            key={tab}
                            hit={hit}
                            tab={tab}
                            slot={slot}
                            grapherState={grapherState}
                            onClick={onClick}
                        />
                    )
                )}

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

    const grapherTabs = hit.availableTabs.filter(
        (tab) => tab !== GRAPHER_TAB_NAMES.Table
    )
    const placedTabs = placeGrapherTabsInGridLayout(grapherTabs, {
        hasDataDisplay: !!dataDisplayProps,
    })

    return (
        <div ref={ref} className="search-chart-hit-medium">
            <SearchChartHitHeader
                hit={hit}
                url={chartUrl}
                source={chartInfo?.source}
                onClick={onClick}
            />

            <div className="search-chart-hit-medium__content">
                {placedTabs.map(({ tab, slot }) => {
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

function CaptionedTable({
    hit,
    tab,
    slot = GridSlot.SingleSlot,
    grapherState,
    onClick,
}: {
    hit: SearchChartHit
    tab: GrapherTabName
    slot?: GridSlot
    grapherState: GrapherState
    onClick?: () => void
}): React.ReactElement {
    const { chartUrl } = constructChartAndPreviewUrlsForTab({
        hit,
        grapherState,
        tab,
    })

    // Construct caption
    const numAvailableEntities =
        grapherState.addCountryMode === EntitySelectionMode.Disabled
            ? grapherState.transformedTable.availableEntityNames.length
            : grapherState.availableEntityNames.length
    const caption =
        numAvailableEntities === 1
            ? `Data available for ${numAvailableEntities} ${grapherState.entityType}`
            : `Data available for ${numAvailableEntities} ${grapherState.entityTypePlural}`

    const maxRows = getRowCountForGridSlot(slot, NUM_DATA_TABLE_ROWS_PER_COLUMN)
    const dataTableProps = buildChartHitDataTableProps({
        grapherState,
        maxRows,
    })

    return (
        <CaptionedLink
            caption={caption}
            url={chartUrl}
            className={slot}
            onClick={onClick}
        >
            <SearchChartHitDataTable {...dataTableProps} />
        </CaptionedLink>
    )
}

function CaptionedThumbnail({
    hit,
    tab,
    grapherState,
    slot = GridSlot.SingleSlot,
    onClick,
}: {
    hit: SearchChartHit
    tab: GrapherTabName
    grapherState: GrapherState
    slot?: GridSlot
    onClick?: () => void
}): React.ReactElement {
    const { chartUrl, previewUrl } = constructChartAndPreviewUrlsForTab({
        hit,
        grapherState,
        tab,
    })

    let caption = makeLabelForGrapherTab(tab, { format: "long" })

    // Add the map time to the caption if it's different from the chart's end time
    if (tab === GRAPHER_TAB_NAMES.WorldMap) {
        const mapTime = grapherState.map.time
            ? findClosestTime(grapherState.times, grapherState.map.time)
            : undefined

        if (mapTime && mapTime !== grapherState.endTime) {
            const formattedMapTime =
                grapherState.table.timeColumn.formatTime(mapTime)
            caption += ` (${formattedMapTime})`
        }
    }

    return (
        <CaptionedLink
            caption={caption}
            url={chartUrl}
            className={slot}
            onClick={onClick}
        >
            <SearchChartHitThumbnail previewUrl={previewUrl} />
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

function pickEntitiesForDisplay({
    grapherState,
    pickedEntities,
}: {
    grapherState: GrapherState
    pickedEntities: EntityName[] // picked by the user
}): EntityName[] {
    // Make sure the default entities actually exist in the chart
    const defaultEntities = grapherState.selection.selectedEntityNames.filter(
        (entityName) =>
            grapherState.table.availableEntityNameSet.has(entityName)
    )

    if (pickedEntities.length === 0) return defaultEntities

    return match(grapherState.addCountryMode)
        .with(EntitySelectionMode.Disabled, () => {
            // Entity selection is disabled, so the default entities are the only valid choice
            return defaultEntities
        })
        .with(EntitySelectionMode.SingleEntity, () => {
            // Only a single entity can be selected at a time, so pick the first one,
            // or rely on the default selection if none is picked
            return pickedEntities.length > 0
                ? [pickedEntities[0]]
                : defaultEntities
        })
        .with(EntitySelectionMode.MultipleEntities, () => {
            const { seriesStrategy = SeriesStrategy.entity } =
                grapherState.chartState
            const isEntityStrategy = seriesStrategy === SeriesStrategy.entity

            // Don't add entities if columns are plotted since Grapher would switch to faceting mode
            if (!isEntityStrategy) return pickedEntities

            const nonDefaultPickedEntities = pickedEntities.filter(
                (entity) => !defaultEntities.includes(entity)
            )

            // Fill up the remaining slots with the default ones
            return [...nonDefaultPickedEntities, ...defaultEntities]
        })
        .exhaustive()
}

function constructChartAndPreviewUrlsForTab({
    hit,
    grapherState,
    tab,
}: {
    hit: SearchChartHit
    grapherState: GrapherState
    tab: GrapherTabName
}): { chartUrl: string; previewUrl: string } {
    // Use Grapher's changedParams to construct chart and preview URLs.
    // We override the tab parameter because the GrapherState is currently set to
    // the first tab of the chart, but we need to generate URLs for the specific
    // tab being rendered in this preview.
    const grapherParams = {
        ...grapherState.changedParams,
        tab: mapGrapherTabNameToQueryParam(tab),
    }

    const previewUrl = constructThumbnailUrl({ hit, grapherParams })

    const chartUrl = constructChartUrl({
        hit,
        // We don't want to link to a chart where entities are highlighted
        grapherParams: R.omit(grapherParams, ["focus"]),
    })

    return { chartUrl, previewUrl }
}
