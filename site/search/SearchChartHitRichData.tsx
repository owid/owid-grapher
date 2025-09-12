import { useMemo } from "react"
import { runInAction } from "mobx"
import cx from "classnames"
import { useMediaQuery } from "usehooks-ts"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { match } from "ts-pattern"
import { GrapherState } from "@ourworldindata/grapher"
import {
    EntityName,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
} from "@ourworldindata/types"
import { Button } from "@ourworldindata/components"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import { SearchChartHitComponentProps } from "./searchTypes.js"
import { useSearchChartHitData } from "./useSearchChartHitData.js"
import { constructChartUrl, pickEntitiesForChartHit } from "./searchUtils.js"
import {
    configureGrapherStateFocus,
    configureGrapherStateForLayout,
    configureGrapherStateSelection,
    configureGrapherStateTab,
    getSortedGrapherTabsForChartHit,
    getTotalColumnCount,
    pickEntitiesForDisplay,
    resetGrapherColors,
    getTableRowCountForGridSlot,
    makeSlotClassNames,
    findTableSlot,
    getPreviewType,
    constructChartAndPreviewUrlsForTab,
} from "./SearchChartHitRichDataHelpers.js"
import { calculateMediumVariantLayout } from "./SearchChartHitRichDataMediumVariantHelpers.js"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"
import { CaptionedTable } from "./SearchChartHitCaptionedTable.js"
import { CaptionedThumbnail } from "./SearchChartHitCaptionedThumbnail.js"
import { SearchChartHitDataDisplay } from "./SearchChartHitDataDisplay.js"
import { SearchChartHitRichDataFallback } from "./SearchChartHitRichDataFallback.js"
import {
    GridSlot,
    LargeVariantGridSlot,
    Layout,
    MediumVariantGridSlot,
    PreviewVariant,
    RichDataComponentVariant,
} from "./SearchChartHitRichDataTypes.js"
import {
    calculateLargePreviewImageDimensions,
    calculateLargeVariantLayout,
} from "./SearchChartHitRichDataLargeVariantHelpers.js"

// Keep in sync with $num-rows-per-column in SearchChartHitRichData.scss
const NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_MEDIUM_VARIANT = 4
const NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_LARGE_VARIANT = 10

export function SearchChartHitRichData({
    hit,
    searchQueryRegionsMatches,
    onClick,
    variant,
}: SearchChartHitComponentProps & {
    variant: RichDataComponentVariant
}) {
    const isLargeVariant = variant === "large"
    const numDataTableRowsPerColumn = isLargeVariant
        ? NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_LARGE_VARIANT
        : NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_MEDIUM_VARIANT

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
        const layout = calculateLayout(variant, grapherState, {
            sortedTabs,
            entityForDataDisplay: pickedEntities[0],
            numDataTableRowsPerColumn,
        })

        // We might need to adjust entity selection and focus according to the chosen layout
        const tableSlot = findTableSlot(layout)
        if (layout && tableSlot) {
            configureGrapherStateForLayout(grapherState, {
                dataTableContent: layout.dataTableContent,
                numAvailableDataTableRows: getTableRowCountForGridSlot(
                    tableSlot,
                    numDataTableRowsPerColumn
                ),
                maxNumEntitiesInStackedDiscreteBarChart:
                    variant === "large" ? 12 : 6,
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
        return (
            <div ref={ref} className="search-chart-hit-rich-data">
                <SearchChartHitHeader
                    hit={hit}
                    url={constructChartUrl({ hit })}
                    onClick={onClick}
                />
                <RichDataContentPlaceholder variant={variant} />
            </div>
        )
    }

    const countryParam = grapherState.changedParams.country
    const grapherParams = countryParam ? { country: countryParam } : undefined
    const chartUrl = constructChartUrl({ hit, grapherParams })

    const contentStyle = {
        "--num-columns": getTotalColumnCount(layout?.placedTabs ?? []),
    } as React.CSSProperties

    const sourcesUrl = constructChartUrl({ hit, overlay: "sources" })
    const downloadUrl = constructChartUrl({ hit, overlay: "download-data" })

    return (
        <div ref={ref} className="search-chart-hit-rich-data">
            <div className="search-chart-hit-rich-data__header">
                <SearchChartHitHeader
                    hit={hit}
                    url={chartUrl}
                    source={{ text: grapherState.sourcesLine, url: sourcesUrl }}
                    showLogo={isLargeVariant}
                    onClick={onClick}
                />
                <Button
                    text="Download options"
                    className="search-chart-hit-rich-data__button"
                    theme="solid-light-blue"
                    href={downloadUrl}
                    icon={faDownload}
                    iconPosition="left"
                />
            </div>

            <div
                className={cx(
                    "search-chart-hit-rich-data__content",
                    `search-chart-hit-rich-data__content--${variant}`
                )}
                style={contentStyle}
            >
                {layout?.placedTabs.map(({ tab, slot }, tabIndex) => {
                    // Always use the complete version on smaller screens since
                    // the table might not be visible
                    const isPrimaryTab = tabIndex === 0
                    const isSmallSlot =
                        slot === MediumVariantGridSlot.SmallLeft ||
                        slot === MediumVariantGridSlot.SmallRight
                    const previewType = isMediumScreen
                        ? {
                              variant: PreviewVariant.Thumbnail,
                              isMinimal: false,
                          }
                        : getPreviewType(variant, { isPrimaryTab, isSmallSlot })

                    const { width: imageWidth, height: imageHeight } =
                        previewType.variant === PreviewVariant.Large
                            ? calculateLargePreviewImageDimensions(
                                  layout as Layout<LargeVariantGridSlot>
                              )
                            : {}

                    const { chartUrl, previewUrl } =
                        constructChartAndPreviewUrlsForTab({
                            hit,
                            grapherState,
                            tab,
                            previewType,
                            imageWidth,
                            imageHeight,
                        })

                    const maxRows = getTableRowCountForGridSlot(
                        slot,
                        numDataTableRowsPerColumn
                    )

                    const className = makeSlotClassNames(variant, slot)

                    return tab === GRAPHER_TAB_NAMES.Table ? (
                        <CaptionedTable
                            key={tab}
                            chartUrl={chartUrl}
                            grapherState={grapherState}
                            maxRows={maxRows}
                            className={className}
                            onClick={onClick}
                        />
                    ) : (
                        <CaptionedThumbnail
                            key={tab}
                            chartType={tab}
                            chartUrl={chartUrl}
                            previewUrl={previewUrl}
                            grapherState={grapherState}
                            imageWidth={imageWidth}
                            imageHeight={imageHeight}
                            className={className}
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

function RichDataContentPlaceholder({
    variant,
}: {
    variant: RichDataComponentVariant
}): React.ReactElement {
    return match(variant)
        .with("medium", () => <RichDataContentMediumVariantPlaceholder />)
        .with("large", () => <RichDataContentLargeVariantPlaceholder />)
        .exhaustive()
}

function RichDataContentMediumVariantPlaceholder(): React.ReactElement {
    return (
        <div
            className="search-chart-hit-rich-data__content search-chart-hit-rich-data__content--medium"
            style={{ "--num-columns": 3 } as React.CSSProperties}
        >
            <GrapherThumbnailPlaceholder
                variant="medium"
                slot={MediumVariantGridSlot.Single}
            />
            <GrapherThumbnailPlaceholder
                variant="medium"
                slot={MediumVariantGridSlot.Single}
            />
            <GrapherThumbnailPlaceholder
                variant="medium"
                slot={MediumVariantGridSlot.Single}
            />
        </div>
    )
}

function RichDataContentLargeVariantPlaceholder(): React.ReactElement {
    return (
        <div className="search-chart-hit-rich-data__content search-chart-hit-rich-data__content--large">
            <GrapherThumbnailPlaceholder
                variant="large"
                slot={LargeVariantGridSlot.LeftQuad}
            />
            <GrapherThumbnailPlaceholder
                variant="large"
                slot={LargeVariantGridSlot.RightQuadLeftColumn}
            />
            <GrapherThumbnailPlaceholder
                variant="large"
                slot={LargeVariantGridSlot.SingleCell}
            />
            <GrapherThumbnailPlaceholder
                variant="large"
                slot={LargeVariantGridSlot.SingleCell}
            />
        </div>
    )
}

function GrapherThumbnailPlaceholder({
    variant,
    slot,
}: {
    variant: RichDataComponentVariant
    slot: GridSlot
}): React.ReactElement {
    return (
        <div
            className={cx(
                "search-chart-hit-rich-data__placeholder",
                makeSlotClassNames(variant, slot)
            )}
        >
            <div className="search-chart-hit-rich-data__thumbnail-placeholder" />
            <div className="search-chart-hit-rich-data__captioned-link-label" />
        </div>
    )
}

function calculateLayout(
    variant: RichDataComponentVariant,
    grapherState: GrapherState,
    args: {
        sortedTabs: GrapherTabName[]
        entityForDataDisplay?: EntityName
        numDataTableRowsPerColumn: number
    }
): Layout<GridSlot> | undefined {
    return match(variant)
        .with("large", () => calculateLargeVariantLayout(grapherState, args))
        .with("medium", () => calculateMediumVariantLayout(grapherState, args))
        .exhaustive()
}
