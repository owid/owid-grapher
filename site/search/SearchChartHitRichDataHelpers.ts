import * as R from "remeda"
import { match } from "ts-pattern"
import {
    EntityName,
    EntitySelectionMode,
    FacetStrategy,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    SeriesStrategy,
} from "@ourworldindata/types"
import { SearchChartHitDataTableContent } from "./SearchChartHitDataTableHelpers"
import {
    GrapherState,
    mapGrapherTabNameToConfigOption,
    StackedDiscreteBarChartState,
} from "@ourworldindata/grapher"
import { SearchChartHitDataTableProps } from "./SearchChartHitDataTable"
import { SearchChartHitDataPointsProps } from "./SearchChartHitDataPoints"
import {
    GridSlot,
    LargeVariantGridSlot,
    Layout,
    MediumVariantGridSlot,
    PlacedTab,
    RichDataComponentVariant,
} from "./SearchChartHitRichDataTypes.js"

export function getSortedGrapherTabsForChartHit(
    grapherState: GrapherState,
    maxTabs = 5
): GrapherTabName[] {
    const { Table, LineChart, Marimekko, WorldMap } = GRAPHER_TAB_NAMES

    // Original chart config before search customizations
    // (entity selection, tab switching, etc.)
    const originalGrapherState = grapherState.authorsVersion

    const {
        availableTabs,
        validChartTypes: availableChartTypes,
        validChartTypeSet: availableChartTypeSet,
    } = originalGrapherState

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

    // Fill up the remaining positions
    sortedTabs.push(...availableTabs.filter((tab) => !sortedTabs.includes(tab)))

    return sortedTabs.slice(0, maxTabs)
}

export function pickEntitiesForDisplay(
    grapherState: GrapherState,
    { pickedEntities }: { pickedEntities: EntityName[] }
): EntityName[] {
    // Original chart config before search customizations
    // (entity selection, tab switching, etc.)
    const originalGrapherState = grapherState.authorsVersion

    // Make sure the default entities actually exist in the chart
    const defaultEntities = originalGrapherState.selectedEntityNames.filter(
        (entityName) =>
            grapherState.table.availableEntityNameSet.has(entityName)
    )

    return match(originalGrapherState.addCountryMode)
        .with(EntitySelectionMode.Disabled, () => {
            // Entity selection is disabled, so the default entities are the
            // only valid choice, unless we're dealing with a chart type where
            // all entities are plotted by default. In that case _highlighting_
            // an entity is valid even when entity _selection_ is disabled
            return originalGrapherState.isScatter ||
                originalGrapherState.isMarimekko
                ? pickedEntities
                : defaultEntities
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
                originalGrapherState.chartState
            const isEntityStrategy = seriesStrategy === SeriesStrategy.entity

            // Use the author's explicitly selected facet strategy if available,
            // otherwise fall back to the computed one. This is necessary because
            // the authorsVersion state we're working with here lacks the data table
            // that facetStrategy computation requires, so the computed value may be
            // incorrect.
            const facetStrategy =
                originalGrapherState.selectedFacetStrategy ??
                originalGrapherState.facetStrategy
            const isFaceted = facetStrategy !== FacetStrategy.none

            // When multiple entities can be selected, the basic strategy is to
            // combine the user-picked entities with the chart's default entities,
            // but we make exceptions for certain cases where doing so would
            // create crowded or unreadable charts.

            // Don't combine picked and default entities if the chart is
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
                    originalGrapherState.hasMultipleSeriesPerFacet
                )
                    return [defaultEntities[0]]

                // Otherwise, rely on the default selection
                return defaultEntities
            }

            // Don't combine picked and default entities if columns are
            // plotted since Grapher would switch to faceting mode
            if (!isEntityStrategy) {
                return pickedEntities.length > 0
                    ? pickedEntities
                    : defaultEntities
            }

            // Combine the picked entities with the default ones.
            // It's important to prepend the picked entities because we later
            // take the first N entities to render if there are space constraints
            return R.unique([...pickedEntities, ...defaultEntities])
        })
        .exhaustive()
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

export function configureGrapherStateSelection(
    grapherState: GrapherState,
    { entities }: { entities: EntityName[] }
): void {
    if (entities.length > 0)
        grapherState.selection.setSelectedEntities(entities)
}

export function configureGrapherStateFocus(
    grapherState: GrapherState,
    { entities }: { entities: EntityName[] }
): void {
    const { seriesStrategy = SeriesStrategy.entity } = grapherState.chartState
    if (
        entities.length > 0 &&
        // focusing entities only makes sense when we're plotting entities
        seriesStrategy === SeriesStrategy.entity &&
        grapherState.facetStrategy !== FacetStrategy.entity
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

export function resetGrapherColors(grapherState: GrapherState): void {
    grapherState.seriesColorMap?.clear()
}

export function configureGrapherStateForLayout(
    grapherState: GrapherState,
    {
        dataTableContent,
        numAvailableDataTableRows,
    }: {
        dataTableContent: SearchChartHitDataTableContent
        numAvailableDataTableRows: number
    }
) {
    match(dataTableContent)
        .with({ type: "data-table" }, (dataTableContent) =>
            configureGrapherStateForDataTable(grapherState, {
                props: dataTableContent.props,
                numAvailableDataTableRows,
            })
        )
        .with({ type: "data-points" }, (dataTableContent) =>
            configureGrapherStateForDataPoints(grapherState, {
                props: dataTableContent.props,
            })
        )
        .exhaustive()

    // For stacked discrete bar charts, we display multiple stacked bars in the
    // chart but the data table only shows values for one entity. We highlight
    // the entity whose data is shown in the table
    if (grapherState.isStackedDiscreteBar) {
        const chartState =
            grapherState.chartState as StackedDiscreteBarChartState
        const entity =
            grapherState.focusArray.seriesNames[0] ??
            chartState.sortedItems?.[0]?.entityName
        if (entity) grapherState.focusArray.clearAllAndAdd(entity)
    }

    // If the selected entities are the same as the authored ones, they won't
    // be persisted in the (thumbnail) URL, so we must update the local grapherState
    // to make sure they're in the same order. The order is of importance in
    // stacked area charts for example.
    if (
        grapherState.selection.hasSelection &&
        !grapherState.areSelectedEntitiesDifferentThanAuthors
    ) {
        grapherState.selection.setSelectedEntities(
            grapherState.legacyConfigAsAuthored.selectedEntityNames ?? []
        )
    }
}

function configureGrapherStateForDataTable(
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

    if (seriesStrategy === SeriesStrategy.entity) {
        // When plotting entities as series, limit the selection to only
        // those that can be displayed in the table rows to ensure
        // thumbnails and table show the same data
        grapherState.selection.setSelectedEntities(
            selectedEntities.slice(0, numAvailableDataTableRows)
        )
    } else if (
        seriesStrategy === SeriesStrategy.column &&
        !grapherState.isFaceted &&
        !grapherState.hasProjectedData &&
        !grapherState.isStackedDiscreteBar
    ) {
        // When plotting columns as series, focus only the subset of columns
        // that can be displayed in the table
        const seriesNames = props.rows
            .slice(0, numAvailableDataTableRows)
            .map((row) => row.seriesName)
            .filter((seriesName) => seriesName !== undefined)
        grapherState.focusArray.clearAllAndAdd(...seriesNames)
    }
}

function configureGrapherStateForDataPoints(
    grapherState: GrapherState,
    { props }: { props: SearchChartHitDataPointsProps }
): void {
    // Highlight the entities that are displayed as data points in the chart
    const entityNames = props.dataPoints.map(
        (dataPoint) => dataPoint.entityName
    )
    if (entityNames.length) {
        grapherState.focusArray.clearAllAndAdd(...entityNames)
        grapherState.selection.setSelectedEntities(entityNames)
    }
}

function getTableColumnCountForGridSlot(slot: GridSlot): number {
    return (
        match(slot)
            // medium variant grid slots
            .with(MediumVariantGridSlot.Single, () => 1)
            .with(MediumVariantGridSlot.Double, () => 2)
            .with(MediumVariantGridSlot.Triple, () => 3)
            .with(MediumVariantGridSlot.Quad, () => 4)
            .with(MediumVariantGridSlot.SmallLeft, () => 1)
            .with(MediumVariantGridSlot.SmallRight, () => 1)

            // large variant grid slots
            .with(LargeVariantGridSlot.LeftQuad, () => 2)
            .with(LargeVariantGridSlot.RightQuad, () => 2)
            .with(LargeVariantGridSlot.RightQuadLeftColumn, () => 1)
            .with(LargeVariantGridSlot.SingleCell, () => 0.5)
            .with(LargeVariantGridSlot.TopRightCell, () => 0.5)
            .with(LargeVariantGridSlot.BottomRightCell, () => 0.5)
            .with(LargeVariantGridSlot.RightQuadBottomRow, () => 2)
            .with(LargeVariantGridSlot.Full, () => 4)
            .exhaustive()
    )
}

/** Number of table rows that can fit in a grid slot */
export function getTableRowCountForGridSlot(
    slot: GridSlot,
    numRowsPerColumn: number
): number {
    const numColumns = getTableColumnCountForGridSlot(slot)
    return numColumns * numRowsPerColumn
}

/** Number of table columns for a number of placed tabs */
export function getTotalColumnCount(placedTabs: PlacedTab<GridSlot>[]): number {
    return R.sumBy(placedTabs, (tab) =>
        getTableColumnCountForGridSlot(tab.slot)
    )
}

export function findTableSlot(layout?: Layout<GridSlot>): GridSlot | undefined {
    return layout?.placedTabs.find(({ tab }) => tab === GRAPHER_TAB_NAMES.Table)
        ?.slot
}

export function makeSlotClassNames(
    variant: RichDataComponentVariant,
    slot: GridSlot
): string {
    const baseName = `${variant}-variant`
    return `${baseName}__slot ${baseName}__${slot}`
}
