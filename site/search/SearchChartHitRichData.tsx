import { useMemo } from "react"
import { runInAction } from "mobx"
import * as R from "remeda"
import { useMediaQuery } from "usehooks-ts"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import {
    GrapherState,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import {
    FacetStrategy,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
} from "@ourworldindata/types"
import { Button } from "@ourworldindata/components"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { SearchChartHit, SearchChartHitComponentProps } from "./searchTypes.js"
import { useSearchChartHitData } from "./useSearchChartHitData.js"
import {
    constructChartUrl,
    constructPreviewUrl,
    pickEntitiesForChartHit,
    PreviewVariant,
} from "./searchUtils.js"
import {
    calculateMediumHitLayout,
    configureGrapherStateFocus,
    configureGrapherStateForLayout,
    configureGrapherStateSelection,
    configureGrapherStateTab,
    getRowCountForMediumHitGridSlot,
    getSortedGrapherTabsForChartHit,
    getTotalColumnCount,
    pickEntitiesForDisplay,
    resetGrapherColors,
} from "./SearchChartHitRichDataHelpers.js"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"
import { CaptionedTable } from "./SearchChartHitCaptionedTable.js"
import { CaptionedThumbnail } from "./SearchChartHitCaptionedThumbnail.js"
import { SearchChartHitDataDisplay } from "./SearchChartHitDataDisplay.js"
import { SearchChartHitRichDataFallback } from "./SearchChartHitRichDataFallback.js"

export function SearchChartHitRichData({
    hit,
    searchQueryRegionsMatches,
    onClick,
    numDataTableRowsPerColumn,
}: SearchChartHitComponentProps & { numDataTableRowsPerColumn: number }) {
    const isMediumScreen = useMediaQuery(MEDIUM_BREAKPOINT_MEDIA_QUERY)

    const { ref, grapherState, status } = useSearchChartHitData(hit)

    // Entities selected by the user
    const pickedEntities = useMemo(
        () => pickEntitiesForChartHit(hit, searchQueryRegionsMatches),
        [hit, searchQueryRegionsMatches]
    )

    // The grapherState contains MobX observables. When observable values are modified,
    // MobX automatically triggers reactions and recomputes derived values. To improve
    // performance, we wrap all state modifications in runInAction() so that MobX
    // batches all changes and only runs expensive computations (like transformTable)
    // once at the end, rather than after each individual state change.
    const layout = runInAction(() => {
        // Find Grapher tabs to display and bring them in the right order
        const sortedTabs = getSortedGrapherTabsForChartHit(grapherState)

        // Choose the entities to display
        const displayEntities = pickEntitiesForDisplay(grapherState, {
            pickedEntities,
        })

        // Bring Grapher into the right state for this search result:
        // - Set the tab to the leftmost tab in the sorted list
        // - Select the entities determined for this search result
        // - Highlight the entity (or entities) the user picked
        configureGrapherStateTab(grapherState, { tab: sortedTabs[0] })
        configureGrapherStateSelection(grapherState, {
            entities: displayEntities,
        })
        configureGrapherStateFocus(grapherState, { entities: pickedEntities })

        // Place Grapher tabs into grid layout and calculate info for data display
        const layout = calculateMediumHitLayout(grapherState, {
            sortedTabs,
            entityForDataDisplay: pickedEntities[0],
            numDataTableRowsPerColumn,
        })

        // We might need to adjust entity selection and focus according to the chosen layout
        const tableSlot = layout?.placedTabs.find(
            ({ tab }) => tab === GRAPHER_TAB_NAMES.Table
        )?.slot
        if (tableSlot) {
            configureGrapherStateForLayout(grapherState, {
                dataTableContent: layout.dataTableContent,
                numAvailableDataTableRows: getRowCountForMediumHitGridSlot(
                    tableSlot,
                    numDataTableRowsPerColumn
                ),
            })
        }

        // Reset the persisted color map to make sure the data table
        // and thumbnails use the some colors for the same entities
        resetGrapherColors(grapherState)

        return layout
    })

    // Render the fallback component if config or data loading failed
    if (status === "error") {
        return (
            <SearchChartHitRichDataFallback
                hit={hit}
                searchQueryRegionsMatches={searchQueryRegionsMatches}
                onClick={onClick}
            />
        )
    }

    // Render a placeholder component while the config and data are loading
    if (status === "loading") {
        const chartUrl = constructChartUrl({ hit })

        return (
            <div ref={ref} className="search-chart-hit-rich-data">
                <SearchChartHitHeader
                    hit={hit}
                    url={chartUrl}
                    onClick={onClick}
                />

                <div
                    className="search-chart-hit-rich-data__content"
                    style={{ "--num-columns": 3 } as React.CSSProperties}
                >
                    <GrapherThumbnailPlaceholder />
                    <GrapherThumbnailPlaceholder />
                    <GrapherThumbnailPlaceholder />
                </div>
            </div>
        )
    }

    const countryParam = grapherState.changedParams.country
    const grapherParams = countryParam ? { country: countryParam } : undefined
    const chartUrl = constructChartUrl({ hit, grapherParams })

    const contentStyle = {
        "--num-columns": getTotalColumnCount(layout?.placedTabs ?? []),
    } as React.CSSProperties

    return (
        <div ref={ref} className="search-chart-hit-rich-data">
            <div className="search-chart-hit-rich-data__header">
                <SearchChartHitHeader
                    hit={hit}
                    url={chartUrl}
                    source={grapherState.sourcesLine}
                    onClick={onClick}
                />
                <Button
                    text="Download options"
                    className="search-chart-hit-rich-data__download-button"
                    theme="solid-light-blue"
                    href={constructChartUrl({ hit, overlay: "download-data" })}
                    icon={faDownload}
                    iconPosition="left"
                />
            </div>

            <div
                className="search-chart-hit-rich-data__content"
                style={contentStyle}
            >
                {layout?.placedTabs.map(({ tab, slot }, tabIndex) => {
                    // Always use the thumbnail version on smaller screens since
                    // the table might not be visible. Otherwise, use the minimal
                    // version for the first tab (which is annotated by the table)
                    // and thumbnails for all other tabs.
                    const previewVariant = isMediumScreen
                        ? "thumbnail"
                        : tabIndex === 0
                          ? "minimal-thumbnail"
                          : "thumbnail"

                    const { chartUrl, previewUrl } =
                        constructChartAndPreviewUrlsForTab({
                            hit,
                            grapherState,
                            tab,
                            previewVariant,
                        })

                    const maxRows = getRowCountForMediumHitGridSlot(
                        slot,
                        numDataTableRowsPerColumn
                    )

                    return tab === GRAPHER_TAB_NAMES.Table ? (
                        <CaptionedTable
                            key={tab}
                            chartUrl={chartUrl}
                            grapherState={grapherState}
                            maxRows={maxRows}
                            className={slot}
                            onClick={onClick}
                        />
                    ) : (
                        <CaptionedThumbnail
                            key={tab}
                            chartType={tab}
                            chartUrl={chartUrl}
                            previewUrl={previewUrl}
                            grapherState={grapherState}
                            className={slot}
                            onClick={onClick}
                        />
                    )
                })}

                {layout?.dataDisplayProps && (
                    <SearchChartHitDataDisplay
                        className="data-slot"
                        {...layout.dataDisplayProps}
                    />
                )}
            </div>
        </div>
    )
}

function GrapherThumbnailPlaceholder(): React.ReactElement {
    return (
        <div className="search-chart-hit-rich-data__placeholder single-slot">
            <div className="search-chart-hit-rich-data__thumbnail-placeholder" />
            <div className="search-chart-hit-rich-data__captioned-link-label" />
        </div>
    )
}

function constructChartAndPreviewUrlsForTab({
    hit,
    grapherState,
    tab,
    previewVariant,
}: {
    hit: SearchChartHit
    grapherState: GrapherState
    tab: GrapherTabName
    previewVariant: PreviewVariant
}): { chartUrl: string; previewUrl: string } {
    // Use Grapher's changedParams to construct chart and preview URLs.
    // We override the tab parameter because the GrapherState is currently set to
    // the first tab of the chart, but we need to generate URLs for the specific
    // tab being rendered in this preview.
    const grapherParams = {
        ...grapherState.changedParams,
        tab: mapGrapherTabNameToQueryParam(tab),
    }

    // Instead of showing a single series per facet,
    // show all series in a single discrete bar chart
    const hasSingleSeriesPerFacet =
        grapherState.isFaceted && !grapherState.hasMultipleSeriesPerFacet
    if (tab === GRAPHER_TAB_NAMES.DiscreteBar && hasSingleSeriesPerFacet) {
        grapherParams.facet = FacetStrategy.none
    }

    const previewUrl = constructPreviewUrl({
        hit,
        grapherParams,
        variant: previewVariant,
    })

    const chartUrl = constructChartUrl({
        hit,
        // We don't want to link to a chart where entities are highlighted
        grapherParams: R.omit(grapherParams, ["focus"]),
    })

    return { chartUrl, previewUrl }
}
