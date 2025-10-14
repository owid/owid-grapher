import * as _ from "lodash-es"
import * as R from "remeda"
import { match } from "ts-pattern"
import {
    fetchInputTableForConfig,
    generateFocusedSeriesNamesParam,
    generateSelectedEntityNamesParam,
    GrapherState,
    mapGrapherTabNameToConfigOption,
    MarimekkoChartState,
    ScatterPlotChartState,
    WORLD_ENTITY_NAME,
} from "@ourworldindata/grapher"
import {
    DimensionProperty,
    EntityName,
    EntitySelectionMode,
    FacetStrategy,
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_NAMES,
    GrapherQueryParams,
    GrapherTabName,
    GridSlotKey,
    LargeVariantGridSlotKey,
    MediumVariantGridSlotKey,
    LayoutSlot,
    SearchChartHitDataDisplayProps,
    SearchChartHitDataTableProps,
    SeriesStrategy,
    Time,
    GrapherSearchResultJson,
} from "@ourworldindata/types"
import { constructSearchResultDataTableContent } from "./constructSearchResultDataTableContent"
import { constructGrapherValuesJson } from "../grapherValuesJson"
import {
    buildChartHitDataDisplayProps,
    checkIsCountry,
    getAggregates,
    getContinents,
    getIncomeGroups,
    getParentRegions,
    getRegionByName,
    getSiblingRegions,
    getTableColumnCountForGridSlotKey,
    omitUndefinedValues,
    getTimeDomainFromQueryString,
    placeGrapherTabsInLargeVariantGrid,
    placeGrapherTabsInMediumVariantGridLayout,
    timeBoundToTimeBoundString,
} from "@ourworldindata/utils"
import { toPlaintext } from "@ourworldindata/components"
import { ColumnTypeMap } from "@ourworldindata/core-table"

// Population variable ID used to fetch latest population data for entities.
// This data helps determine which entities to display in Scatter plots and
// Marimekko charts when no specific selection is made
const POPULATION_VARIABLE_ID = 953903 // "Population (historical) (various sources, 2024-07-15)"

export enum RichDataVariant {
    Medium = "medium",
    Large = "large",
}

type TimeBounds = [Time | undefined, Time | undefined]

export function constructSearchResultJson(
    grapherState: GrapherState,
    {
        variant,
        pickedEntities,
        displayEntities,
        sortedTabs,
        numDataTableRowsPerColumn,
    }: {
        variant: RichDataVariant
        pickedEntities: EntityName[]
        displayEntities: EntityName[]
        sortedTabs: GrapherTabName[]
        numDataTableRowsPerColumn: number
    }
): GrapherSearchResultJson | undefined {
    // Prepare data for the big data value display (if applicable)
    const entityForDataDisplay = pickedEntities[0] ?? WORLD_ENTITY_NAME
    const shouldShowDataDisplay = variant !== RichDataVariant.Large
    const chartInfo = constructGrapherValuesJson(
        grapherState,
        entityForDataDisplay
    )
    const dataDisplayProps = shouldShowDataDisplay
        ? buildChartHitDataDisplayProps({
              chartInfo,
              chartType: grapherState.chartType,
              entity: entityForDataDisplay,
              isEntityPickedByUser: pickedEntities.length > 0,
          })
        : undefined

    // Start and end time for which the picked entity has data
    const pickedTimeBounds: TimeBounds =
        pickedEntities.length > 0
            ? [
                  chartInfo?.startValues?.y[0].time,
                  chartInfo?.endValues?.y[0].time,
              ]
            : [undefined, undefined]

    // Bring Grapher into the right state for this search result:
    // - Select the entities determined for this search result
    // - Highlight the entity (or entities) the user picked
    // - Set the end time (relevant for charts with projections)
    configureGrapherStateSelection(grapherState, {
        entities: displayEntities,
    })
    configureGrapherStateFocus(grapherState, {
        entities: pickedEntities,
    })

    // Construct the data table content (used to determine the grid layout)
    const initialDataTableContent = constructSearchResultDataTableContent({
        grapherState,
    })
    if (!initialDataTableContent) return undefined

    // Place Grapher tabs into the grid layout
    const layout = calculateLayout(variant, grapherState, {
        dataTableContent: initialDataTableContent,
        dataDisplayProps,
        sortedTabs,
        numDataTableRowsPerColumn,
    })
    const tableSlotKey = findTableSlotKey(layout)

    // We might need to adjust entity selection and focus according to the chosen layout
    if (layout && tableSlotKey)
        configureGrapherStateForLayout(grapherState, {
            dataTableContent: initialDataTableContent,
            numAvailableDataTableRows: getTableRowCountForGridSlotKey(
                tableSlotKey,
                numDataTableRowsPerColumn
            ),
            maxNumEntitiesInStackedDiscreteBarChart:
                variant === "large" ? 12 : 6,
        })

    // Reset Grapher colors
    grapherState.seriesColorMap?.clear()

    // Construct the data table content using the updated grapher state
    const maxRows = tableSlotKey
        ? getTableRowCountForGridSlotKey(
              tableSlotKey,
              numDataTableRowsPerColumn
          )
        : undefined
    const dataTableContent = constructSearchResultDataTableContent({
        grapherState,
        maxRows,
    })
    if (!dataTableContent) return undefined

    // Some charts and preview thumbnails need specific grapher query params
    const enrichedLayout = layout.map(({ slotKey, grapherTab }) => {
        const { chartParams, previewParams } = getGrapherQueryParamsForTab({
            grapherState,
            tab: grapherTab,
            timeBounds: pickedTimeBounds,
        })

        return omitUndefinedValues({
            slotKey,
            grapherTab,
            chartParams,
            previewParams,
        })
    })

    const grapherParams = {
        ...grapherState.changedParams,
        // Explicitly set time as query parameter in case it differs from the original chart.
        // This can happen when projections have been removed from the chart.
        time: makeGrapherTimeParam(grapherState, [
            grapherState.startTime,
            grapherState.endTime,
        ]),
    }

    return omitUndefinedValues({
        title: grapherState.title,
        subtitle: stripMarkdown(grapherState.subtitle),
        source: stripMarkdown(grapherState.sourcesLine),
        grapherQueryParams: grapherParams,
        layout: enrichedLayout,
        dataTable: dataTableContent,
        entityType: grapherState.entityType,
        entityTypePlural: grapherState.entityTypePlural,
    })
}

export function getSortedGrapherTabsForChartHit(
    grapherState: GrapherState
): GrapherTabName[] {
    const { Table, LineChart, Marimekko, WorldMap, DiscreteBar } =
        GRAPHER_TAB_NAMES

    const {
        availableTabs,
        validChartTypes: availableChartTypes,
        validChartTypeSet: availableChartTypeSet,
    } = grapherState

    const sortedTabs: GrapherTabName[] = []

    // First position
    if (availableChartTypeSet.has(LineChart)) {
        // If a line chart is available, it's always the first tab
        sortedTabs.push(LineChart)
    } else if (availableChartTypes.length > 0) {
        // Otherwise, pick the first valid chart type
        sortedTabs.push(availableChartTypes[0])
    } else if (availableTabs.includes(WorldMap)) {
        // Or a map
        sortedTabs.push(WorldMap)
    } else if (availableTabs.includes(Table)) {
        // Or a table
        sortedTabs.push(Table)
    }

    // Second position is always the table
    // (unless the table is already in the first position)
    if (sortedTabs[0] !== Table) sortedTabs.push(Table)

    // In the third position, prioritize the Marimekko chart
    if (sortedTabs[0] === LineChart && availableChartTypeSet.has(Marimekko)) {
        sortedTabs.push(Marimekko)
    }

    // Fill up the remaining positions, with the discrete bar chart last
    const remainingTabs = availableTabs.filter(
        (tab) => !sortedTabs.includes(tab)
    )
    const remainingTabsExceptDiscreteBar = remainingTabs.filter(
        (tab) => tab !== DiscreteBar
    )
    sortedTabs.push(...remainingTabsExceptDiscreteBar)
    if (remainingTabs.includes(DiscreteBar)) sortedTabs.push(DiscreteBar)

    return sortedTabs
}

export async function pickDisplayEntities(
    grapherState: GrapherState,
    {
        pickedEntities,
        dataApiUrl,
    }: { pickedEntities: EntityName[]; dataApiUrl?: string }
): Promise<EntityName[]> {
    const { ScatterPlot, Marimekko } = GRAPHER_CHART_TYPES
    const {
        chartType,
        addCountryMode,
        selectedEntityNames: defaultEntities,
        availableEntityNames: availableEntities,
    } = grapherState
    const { seriesStrategy = SeriesStrategy.entity } = grapherState.chartState
    const isEntityStrategy = seriesStrategy === SeriesStrategy.entity
    const facetStrategy = grapherState.facetStrategy
    const isFaceted = facetStrategy !== FacetStrategy.none

    /** Find comparison entities and add them to the ones picked by the user */
    const enrichPickedEntities = () => {
        if (pickedEntities.length === 0) return defaultEntities

        const pickedComparisonEntities = pickComparisonEntities(
            pickedEntities[0],
            availableEntities
        )
        const comparisonEntities =
            pickedComparisonEntities.length > 0
                ? pickedComparisonEntities
                : defaultEntities

        // It's important to prepend the picked entities because we later
        // take the first N entities to render if there are space constraints
        return R.unique([...pickedEntities, ...comparisonEntities])
    }

    // Only a single entity can be selected at a time, so pick the first one,
    // or rely on the default selection if none is picked
    if (addCountryMode === EntitySelectionMode.SingleEntity) {
        return pickedEntities.length > 0 ? [pickedEntities[0]] : defaultEntities
    }

    // Scatter plots and Marimekko charts are special because they're
    // the only chart types where all entities are plotted by default
    if (chartType === ScatterPlot || chartType === Marimekko) {
        const pickEntitiesForScatterOrMarimekko = () =>
            match(chartType)
                .with(ScatterPlot, () => {
                    const chartState =
                        grapherState.chartState as ScatterPlotChartState
                    return pickDisplayEntitiesForScatterPlot({
                        grapherState,
                        chartState,
                        dataApiUrl,
                        entity: pickedEntities[0],
                    })
                })
                .with(Marimekko, () => {
                    const chartState =
                        grapherState.chartState as MarimekkoChartState
                    return pickDisplayEntitiesForMarimekko({
                        grapherState,
                        chartState,
                        dataApiUrl,
                        entity: pickedEntities[0],
                    })
                })
                .exhaustive()

        // Find entities for comparison and combine them with the picked entities
        if (pickedEntities.length > 0) {
            const enrichedEntities = enrichPickedEntities()

            // If we couldn't find any comparison entities,
            // we try to pick a sensible selection based on the chart data
            if (enrichedEntities.length === pickedEntities.length) {
                const newEntities = await pickEntitiesForScatterOrMarimekko()
                return R.unique([...pickedEntities, ...newEntities])
            }

            return enrichedEntities
        }

        // If there are no default entities and the user hasn't picked any,
        // we try to pick a sensible selection based on the chart data
        if (defaultEntities.length === 0) {
            return pickEntitiesForScatterOrMarimekko()
        }

        return defaultEntities
    }

    // Entity selection is disabled, so the default entities are the only valid choice
    // (this doesn't apply to scatter plots and Marimekko charts because they _highlight_
    // selected entities rather than filtering to them)
    if (addCountryMode === EntitySelectionMode.Disabled) return defaultEntities

    // When multiple entities can be selected, the basic strategy is to
    // pick entities for comparison based on the first picked entity.
    // If no entities for comparison can be found, we rely on the default
    // selection. Those entities are then combined with the user-picked
    // entities, but we make exceptions for certain cases where doing so
    // would create crowded or unreadable charts.

    // Don't combine picked and comparison entities if the chart is
    // faceted because many facets are hard to read in thumbnails
    if (isFaceted) {
        // Choose the user-picked entities if there are any
        if (pickedEntities.length > 0) return pickedEntities

        if (defaultEntities.length === 0) return [] // Shouldn't happen

        // If no entities were picked by the user and the chart is
        // faceted by entity, check if the chart has multiple series
        // per facet. If so, simplify the display by showing only
        // the first default entity (effectively un-faceting the chart)
        if (
            facetStrategy === FacetStrategy.entity &&
            grapherState.hasMultipleSeriesPerFacet
        )
            return [defaultEntities[0]]

        // Otherwise, rely on the default selection
        return defaultEntities
    }

    // If columns are plotted then Grapher would switch to faceting mode
    // if picked and comparison entities were combined
    if (!isEntityStrategy) {
        return pickedEntities.length > 0 ? pickedEntities : defaultEntities
    }

    // Find entities for comparison and combine them with the picked entities
    if (pickedEntities.length > 0) return enrichPickedEntities()

    return defaultEntities
}

async function pickDisplayEntitiesForScatterPlot({
    grapherState,
    chartState,
    dataApiUrl,
    entity,
}: {
    grapherState: GrapherState
    chartState: ScatterPlotChartState
    dataApiUrl?: string
    entity?: EntityName
}): Promise<EntityName[]> {
    const { series, colorColumnSlug, sizeColumnSlug } = chartState

    // Pick income groups or continents if available
    const regions = findBestAvailableRegions(
        grapherState.availableEntityNames,
        { includeWorld: true }
    )
    if (regions.length > 0) return regions

    // Helper functions
    type ScatterSeries = ScatterPlotChartState["series"][number]
    const getName = (series: ScatterSeries) => series.seriesName
    const getColor = (series: ScatterSeries) => series.points.at(0)?.color ?? ""
    const getSize = (series: ScatterSeries) => series.points.at(0)?.size ?? 0
    const getY = (series: ScatterSeries) => series.points.at(0)?.y ?? 0

    // Color of the entity picked by the user
    const pickedColor = grapherState.table
        .get(colorColumnSlug)
        .owidRowsByEntityName.get(entity)?.[0]?.value
    const isDifferentFromPickedColor = (series: ScatterSeries) =>
        !pickedColor || getColor(series) !== pickedColor

    // When both color and size dimensions are available, select the entity
    // with the largest size from each color group
    if (colorColumnSlug && sizeColumnSlug) {
        return maxByGroup(series, getColor, getSize)
            .filter(isDifferentFromPickedColor)
            .map(getName)
    }

    // When only the color dimension is available, select the entity with the
    // largest population from each color group
    if (colorColumnSlug) {
        const populationByEntityName = await fetchLatestPopulationData({
            dataApiUrl,
        })

        const getPopulation = (series: ScatterSeries) =>
            populationByEntityName?.get(series.seriesName) ?? 0

        return maxByGroup(series, getColor, getPopulation)
            .filter(isDifferentFromPickedColor)
            .map(getName)
    }

    // When only the size dimension is available, select the entities
    // with the largest size
    if (sizeColumnSlug) {
        return R.pipe(
            series,
            R.sortBy((series) => -getSize(series)),
            R.map(getName)
        )
    }

    return R.pipe(
        series,
        R.sortBy((series) => -getY(series)),
        R.map(getName)
    )
}

async function pickDisplayEntitiesForMarimekko({
    grapherState,
    chartState,
    dataApiUrl,
    entity,
}: {
    grapherState: GrapherState
    chartState: MarimekkoChartState
    dataApiUrl?: string
    entity?: EntityName
}): Promise<EntityName[]> {
    const { items, colorColumnSlug, xColumnSlug } = chartState

    // Pick income groups or continents if available
    const regions = findBestAvailableRegions(
        grapherState.availableEntityNames,
        { includeWorld: true }
    )
    if (regions.length > 0) return regions

    // Helper functions
    type MarimekkoItem = MarimekkoChartState["items"][number]
    const getName = (item: MarimekkoItem) => item.entityName
    const getColor = (item: MarimekkoItem) =>
        item.entityColor?.colorDomainValue ?? ""
    const getX = (item: MarimekkoItem) => item.xPoint?.value ?? 0
    const getY = (item: MarimekkoItem) => item.bars[0]?.yPoint?.value ?? 0

    // Color of the entity picked by the user
    const pickedColor = grapherState.table
        .get(colorColumnSlug)
        .owidRowsByEntityName.get(entity)?.[0]?.value
    const isDifferentFromPickedColor = (item: MarimekkoItem) =>
        !pickedColor || getColor(item) !== pickedColor

    // When both color and x dimensions are available, select the entity
    // with the largest x from each color group
    if (colorColumnSlug && xColumnSlug) {
        return maxByGroup(items, getColor, getX)
            .filter(isDifferentFromPickedColor)
            .map(getName)
    }

    // When only the color dimension is available, select the entity with the
    // largest population from each color group
    if (colorColumnSlug) {
        const populationByEntityName = await fetchLatestPopulationData({
            dataApiUrl,
        })

        const getPopulation = (item: MarimekkoItem) =>
            populationByEntityName?.get(item.entityName) ?? 0

        return maxByGroup(items, getColor, getPopulation)
            .filter(isDifferentFromPickedColor)
            .map(getName)
    }

    // When only the x dimension is available, select the entities
    // with the largest x
    if (xColumnSlug) {
        return R.pipe(
            items,
            R.sortBy((item) => -getX(item)),
            R.map(getName)
        )
    }

    return R.pipe(
        items,
        R.sortBy((item) => -getY(item)),
        R.map(getName)
    )
}

/**
 * Finds the best available regions from a set of available entities,
 * prioritizing continents, then  income groups, then other aggregates.
 */
function findBestAvailableRegions(
    availableEntities: EntityName[],
    { includeWorld }: { includeWorld: boolean } = { includeWorld: false }
) {
    const availableEntitySet = new Set(availableEntities)

    const regionGroups = [getContinents(), getIncomeGroups(), getAggregates()]
    for (const regions of regionGroups) {
        const availableRegions: EntityName[] = regions
            .filter((region) => availableEntitySet.has(region.name))
            .map((region) => region.name)

        if (availableRegions.length > 0) {
            // Also add the World entity if it's available
            if (includeWorld && availableEntitySet.has(WORLD_ENTITY_NAME)) {
                availableRegions.push(WORLD_ENTITY_NAME)
            }

            return availableRegions
        }
    }
    return []
}

/**
 * Selects relevant comparison entities for a given entity to provide meaningful
 * contextual comparisons in search results.
 */
function pickComparisonEntities(
    entity: EntityName,
    availableEntities: EntityName[]
): EntityName[] {
    const availableEntitySet = new Set(availableEntities)

    const comparisonEntities = new Set<EntityName>()

    // Can't determine comparison entities for non-geographical entities
    const region = getRegionByName(entity)
    if (!region) return []

    // Compare World to any aggregate entities (e.g. continents or income groups)
    if (entity === WORLD_ENTITY_NAME)
        return findBestAvailableRegions(availableEntities)

    // Always include World as a comparison if available
    if (availableEntitySet.has(WORLD_ENTITY_NAME))
        comparisonEntities.add(WORLD_ENTITY_NAME)

    if (checkIsCountry(region)) {
        // For countries: add their parent regions (continent, income group, etc.)
        // Example: Germany -> Europe, Europe (WHO), High income countries
        const regions = getParentRegions(region.name)
        for (const region of regions)
            if (availableEntitySet.has(region.name))
                comparisonEntities.add(region.name)
    } else {
        // For aggregate regions: add sibling regions at the same hierarchical level
        // Example: Europe -> Asia, Africa, North America (other continents)
        const siblings = getSiblingRegions(region.name)
        for (const sibling of siblings) {
            if (availableEntitySet.has(sibling.name))
                comparisonEntities.add(sibling.name)
        }
    }

    return Array.from(comparisonEntities)
}

let _populationDataCache: Map<EntityName, number> | undefined
/**
 * Fetch the latest population data and return a map from entity name to
 * population value. The data is cached after the first fetch to avoid
 * re-fetching and re-processing the table on subsequent calls.
 */
async function fetchLatestPopulationData({
    dataApiUrl,
}: {
    dataApiUrl: string
}): Promise<Map<EntityName, number> | undefined> {
    // Return cached population data if available to avoid re-fetching/re-processing the table
    if (_populationDataCache) return _populationDataCache

    // Fetch population data as OWID table
    const table = await fetchInputTableForConfig({
        dimensions: [
            {
                property: DimensionProperty.y,
                variableId: POPULATION_VARIABLE_ID,
            },
        ],
        dataApiUrl,
    })

    // Filter to the most recent year
    const maxTime = table.maxTime ?? 0
    const populationColumn = table
        .filterByTargetTimes([maxTime])
        .get(POPULATION_VARIABLE_ID.toString())
    if (populationColumn.isMissing) return undefined

    // Create a map from entity name to population value
    const data = new Map<EntityName, number>()
    for (const [entityName, rows] of populationColumn.owidRowsByEntityName) {
        if (rows.length > 0) data.set(entityName, rows[0].value)
    }

    // Update cache
    _populationDataCache = data

    return data
}

export function configureGrapherStateTab(
    grapherState: GrapherState,
    { tab }: { tab: GrapherTabName }
): void {
    if (!tab) return

    // Update Grapher's active tab
    grapherState.tab = mapGrapherTabNameToConfigOption(tab)

    // When a line or slope chart has only a single time point selected by default,
    // Grapher automatically switches to a discrete bar chart. This means the active
    // tab type (DiscreteBar) wouldn't match what we want to render in the preview
    // (LineChart). By ensuring the time handles are on different times, we force
    // Grapher to display the actual line/slope chart instead of a bar chart.
    grapherState.ensureTimeHandlesAreSensibleForTab(tab)
}

function configureGrapherStateSelection(
    grapherState: GrapherState,
    { entities }: { entities: EntityName[] }
): void {
    if (entities.length > 0)
        grapherState.selection.setSelectedEntities(entities)
}

function configureGrapherStateFocus(
    grapherState: GrapherState,
    { entities }: { entities: EntityName[] }
): void {
    const { seriesStrategy = SeriesStrategy.entity } = grapherState.chartState
    if (
        entities.length > 0 &&
        // focusing entities only makes sense when we're plotting entities
        seriesStrategy === SeriesStrategy.entity
    ) {
        const validEntities = entities.filter((entity) =>
            grapherState.selection.selectedSet.has(entity)
        )
        grapherState.focusArray.clearAllAndAdd(...validEntities)
    } else {
        // Clear the focus state for any entities that might be focused by default
        grapherState.focusArray.clear()
    }
}

function calculateLayout(
    variant: RichDataVariant,
    grapherState: GrapherState,
    args: {
        dataTableContent: SearchChartHitDataTableProps
        dataDisplayProps?: SearchChartHitDataDisplayProps
        sortedTabs: GrapherTabName[]
        numDataTableRowsPerColumn: number
    }
): LayoutSlot<GridSlotKey>[] | undefined {
    return match(variant)
        .with(RichDataVariant.Large, () =>
            calculateLargeVariantLayout(grapherState, args)
        )
        .with(RichDataVariant.Medium, () =>
            calculateMediumVariantLayout(grapherState, args)
        )
        .exhaustive()
}

function calculateMediumVariantLayout(
    grapherState: GrapherState,
    {
        dataTableContent,
        dataDisplayProps,
        sortedTabs,
        numDataTableRowsPerColumn,
    }: {
        dataTableContent: SearchChartHitDataTableProps
        dataDisplayProps?: SearchChartHitDataDisplayProps
        sortedTabs: GrapherTabName[]
        numDataTableRowsPerColumn: number
    }
): LayoutSlot<MediumVariantGridSlotKey>[] | undefined {
    // Figure out the layout by assigning each Grapher tab to grid slots.
    // The table tab can optionally span two or more slots (instead of just one)
    // if there's enough space in the grid and enough data to justify it.

    const { seriesStrategy = SeriesStrategy.entity } = grapherState.chartState

    // Determine whether to allow dropping the DiscreteBar tab to make
    // room for the table. We only prioritize the table in this scenario:
    // When plotting columns (rather than entities), we want to
    // label as many columns as possible since all column lines are
    // plotted (they can't be deselected, other than entity lines)
    const prioritizeTableOverDiscreteBar =
        seriesStrategy === SeriesStrategy.column &&
        !grapherState.isFaceted &&
        !grapherState.hasProjectedData &&
        !grapherState.isStackedDiscreteBar

    return placeGrapherTabsInMediumVariantGridLayout(sortedTabs, {
        hasDataTable: true,
        hasDataDisplay: !!dataDisplayProps,
        numDataTableRows: dataTableContent.rows.length,
        numDataTableRowsPerColumn,
        prioritizeTableOverDiscreteBar,
    })
}

function calculateLargeVariantLayout(
    _grapherState: GrapherState,
    {
        dataTableContent,
        sortedTabs,
        numDataTableRowsPerColumn,
    }: {
        dataTableContent: SearchChartHitDataTableProps
        sortedTabs: GrapherTabName[]
        numDataTableRowsPerColumn: number
    }
): LayoutSlot<LargeVariantGridSlotKey>[] | undefined {
    // Figure out the layout by assigning each Grapher tab to grid slots
    return placeGrapherTabsInLargeVariantGrid(sortedTabs, {
        numDataTableRows: dataTableContent.rows.length,
        numDataTableRowsPerColumn,
    })
}

function configureGrapherStateForLayout(
    grapherState: GrapherState,
    {
        dataTableContent,
        numAvailableDataTableRows,
        maxNumEntitiesInStackedDiscreteBarChart,
    }: {
        dataTableContent: SearchChartHitDataTableProps
        numAvailableDataTableRows: number
        maxNumEntitiesInStackedDiscreteBarChart: number
    }
) {
    configureGrapherStateForDataTable(grapherState, {
        props: dataTableContent,
        numAvailableDataTableRows,
        maxNumEntitiesInStackedDiscreteBarChart,
    })
}

function configureGrapherStateForDataTable(
    grapherState: GrapherState,
    args: {
        props: SearchChartHitDataTableProps
        numAvailableDataTableRows: number
        maxNumEntitiesInStackedDiscreteBarChart: number
    }
): void {
    limitSelectionToAvailableTableRows(grapherState, args)

    if (grapherState.isScatter) {
        configureGrapherStateForScatter(grapherState, { props: args.props })
    }

    if (grapherState.isMarimekko) {
        configureGrapherStateForMarimekko(grapherState, { props: args.props })
    }

    if (grapherState.isStackedDiscreteBar) {
        configureGrapherStateForStackedDiscreteBarChart(grapherState, {
            props: args.props,
            maxNumEntities: args.maxNumEntitiesInStackedDiscreteBarChart,
        })
    }
}

function limitSelectionToAvailableTableRows(
    grapherState: GrapherState,
    {
        props,
        numAvailableDataTableRows,
    }: {
        props: SearchChartHitDataTableProps
        numAvailableDataTableRows: number
    }
): void {
    const selectedEntities = grapherState.selection.selectedEntityNames
    const { seriesStrategy = SeriesStrategy.entity } = grapherState.chartState

    // Check how many rows are available for the table and update
    // the selected/focused entities accordingly. This is important to ensure
    // that the table and thumbnail display the same entities/series.
    const numRows = props.rows.length

    // No need to adjust the selection if all rows fit
    if (numRows <= numAvailableDataTableRows) return

    // When plotting entities as series, limit the selection to only
    // those that can be displayed in the table rows to ensure
    // thumbnails and table show the same data
    if (seriesStrategy === SeriesStrategy.entity) {
        grapherState.selection.setSelectedEntities(
            selectedEntities.slice(0, numAvailableDataTableRows)
        )
    }
}

function configureGrapherStateForStackedDiscreteBarChart(
    grapherState: GrapherState,
    {
        props,
        maxNumEntities,
    }: { props: SearchChartHitDataTableProps; maxNumEntities: number }
): void {
    // For stacked discrete bar charts, we display multiple stacked bars in the
    // chart but the data table only shows values for one entity

    // Find the entity that is displayed in the table
    const tableEntity =
        grapherState.yColumnSlugs.length > 1 ? props.title : undefined

    // Limit the number of selected entities to the maximum allowed
    if (grapherState.addCountryMode !== EntitySelectionMode.Disabled) {
        const defaultEntities = grapherState.selection.selectedEntityNames
        const selectedEntities = defaultEntities.slice(0, maxNumEntities)
        if (tableEntity && !selectedEntities.includes(tableEntity)) {
            selectedEntities.pop()
            selectedEntities.push(tableEntity)
        }
        grapherState.selection.setSelectedEntities(selectedEntities)
    }

    // Focus the entity that is displayed in the table
    if (tableEntity) grapherState.focusArray.clearAllAndAdd(tableEntity)
}

function configureGrapherStateForScatter(
    grapherState: GrapherState,
    { props }: { props: SearchChartHitDataTableProps }
): void {
    const displayEntities = props.rows
        .map((row) => row.seriesName)
        .filter((entityName) => entityName !== undefined)

    // Select the entities that are displayed in the data table
    if (displayEntities.length)
        grapherState.selection.setSelectedEntities(displayEntities)
}

function configureGrapherStateForMarimekko(
    grapherState: GrapherState,
    { props }: { props: SearchChartHitDataTableProps }
): void {
    const displayEntities = props.rows
        .map((row) => row.label)
        .filter((entityName) => entityName !== undefined)

    // Select the entities that are displayed in the data table
    if (displayEntities.length)
        grapherState.selection.setSelectedEntities(displayEntities)
}

function getGrapherQueryParamsForTab({
    grapherState,
    tab,
    timeBounds,
}: {
    grapherState: GrapherState
    tab: GrapherTabName
    timeBounds?: TimeBounds
}): { chartParams?: GrapherQueryParams; previewParams?: GrapherQueryParams } {
    // Adjust grapher query params for the preview thumbnail of some chart types
    const params = match(tab)
        .with(GRAPHER_TAB_NAMES.DiscreteBar, () =>
            getGrapherQueryParamsForDiscreteBar(grapherState)
        )
        .with(GRAPHER_TAB_NAMES.Marimekko, () =>
            getGrapherQueryParamsForMarimekko(grapherState)
        )
        .with(GRAPHER_TAB_NAMES.SlopeChart, () =>
            getGrapherQueryParamsForSlopeChart(grapherState, { timeBounds })
        )
        .otherwise(() => undefined)

    if (!params) return { chartParams: undefined, previewParams: undefined }

    const { chartParams, previewParams } = params
    return {
        chartParams: _.isEmpty(chartParams) ? undefined : chartParams,
        previewParams: _.isEmpty(previewParams) ? undefined : previewParams,
    }
}

function getGrapherQueryParamsForMarimekko(
    grapherState: GrapherState
):
    | { chartParams?: GrapherQueryParams; previewParams?: GrapherQueryParams }
    | undefined {
    // If the Marimekko chart has a selection, also set
    // the focus param, so that the selected entities are
    // labelled
    const originalGrapherParams = grapherState.changedParams
    if (!originalGrapherParams.focus && grapherState.selection.hasSelection) {
        return {
            chartParams: undefined,
            previewParams: {
                focus: generateFocusedSeriesNamesParam(
                    grapherState.selection.selectedEntityNames
                ),
            },
        }
    }
}

function getGrapherQueryParamsForDiscreteBar(
    grapherState: GrapherState
):
    | { chartParams?: GrapherQueryParams; previewParams?: GrapherQueryParams }
    | undefined {
    const overwriteParams: GrapherQueryParams = {}

    // Instead of showing a single series per facet,
    // show all series in a single discrete bar chart
    const hasSingleSeriesPerFacet =
        grapherState.isFaceted && !grapherState.hasMultipleSeriesPerFacet
    if (hasSingleSeriesPerFacet) overwriteParams.facet = FacetStrategy.none

    // Add comparison entities to discrete bar charts if
    // only a single entity is currently selected
    const { seriesStrategy = SeriesStrategy.entity } = grapherState.chartState
    const isEntityStrategy = seriesStrategy === SeriesStrategy.entity
    const selectedEntities = grapherState.selection.selectedEntityNames
    if (
        !grapherState.isFaceted &&
        isEntityStrategy &&
        selectedEntities.length === 1
    ) {
        const comparisonEntities = pickComparisonEntities(
            selectedEntities[0],
            grapherState.availableEntityNames
        )
        if (comparisonEntities.length > 1) {
            overwriteParams.country = generateSelectedEntityNamesParam(
                _.uniq([...selectedEntities, ...comparisonEntities])
            )
            overwriteParams.focus =
                generateFocusedSeriesNamesParam(selectedEntities)
        }
    }

    return { chartParams: overwriteParams, previewParams: overwriteParams }
}

function getGrapherQueryParamsForSlopeChart(
    grapherState: GrapherState,
    { timeBounds }: { timeBounds?: TimeBounds }
):
    | { chartParams?: GrapherQueryParams; previewParams?: GrapherQueryParams }
    | undefined {
    const [startTime, endTime] = timeBounds || []

    if (startTime === undefined && endTime === undefined) return

    // Parse the time bounds
    const originalGrapherParams = grapherState.changedParams
    const parsedTime: TimeBounds =
        originalGrapherParams.time !== undefined
            ? getTimeDomainFromQueryString(originalGrapherParams.time)
            : [-Infinity, Infinity]

    // Override the start and end time with the provided values
    const updatedTime: TimeBounds = [
        startTime ?? parsedTime[0],
        endTime ?? parsedTime[1],
    ]

    // Set the time param to the new time bounds
    const params = { time: makeGrapherTimeParam(grapherState, updatedTime) }

    return { chartParams: params, previewParams: params }
}

function makeGrapherTimeParam(
    grapherState: GrapherState,
    timeBounds: TimeBounds
): string {
    const [startTime, endTime] = timeBounds

    const isDailyData =
        grapherState.table.timeColumn instanceof ColumnTypeMap.Day
    const formatTime = (t: Time): string =>
        timeBoundToTimeBoundString(t, isDailyData)

    return [startTime ?? -Infinity, endTime ?? Infinity]
        .map(formatTime)
        .join("..")
}

/** Number of table rows that can fit in a grid slot */
function getTableRowCountForGridSlotKey(
    slot: GridSlotKey,
    numRowsPerColumn: number
): number {
    const numColumns = getTableColumnCountForGridSlotKey(slot)
    return numColumns * numRowsPerColumn
}

function findTableSlotKey(
    layout?: LayoutSlot<GridSlotKey>[]
): GridSlotKey | undefined {
    return layout?.find(
        ({ grapherTab }) => grapherTab === GRAPHER_TAB_NAMES.Table
    )?.slotKey
}

/**
 * Groups an array of items by a key function and returns the item with the
 * maximum value (according to sortFn) from each group
 */
function maxByGroup<T>(
    arr: ReadonlyArray<T>,
    groupFn: (item: T) => string | number,
    sortFn: (item: T) => number
) {
    return R.pipe(
        arr,
        R.groupBy(groupFn),
        R.mapValues((item) => R.firstBy(item, [sortFn, "desc"])),
        R.values()
    )
}

function stripMarkdown(markdown?: string): string | undefined {
    if (!markdown) return undefined
    return toPlaintext(markdown)
}
