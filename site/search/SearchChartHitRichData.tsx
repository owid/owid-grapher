import { useMemo } from "react"
import { runInAction } from "mobx"
import cx from "classnames"
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { match } from "ts-pattern"
import * as R from "remeda"
import {
    GrapherState,
    migrateGrapherConfigToLatestVersion,
    WORLD_ENTITY_NAME,
} from "@ourworldindata/grapher"
import {
    EntityName,
    GRAPHER_TAB_NAMES,
    GrapherInterface,
    GrapherQueryParams,
    GrapherTabName,
    GrapherValuesJson,
    SearchChartHitDataTableContent,
} from "@ourworldindata/types"
import { Button } from "@ourworldindata/components"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import {
    ChartRecordType,
    SearchChartHit,
    SearchChartHitComponentProps,
} from "./searchTypes.js"
import {
    constructChartUrl,
    constructConfigUrl,
    constructSearchTableUrl,
    pickEntitiesForChartHit,
} from "./searchUtils.js"
import {
    configureGrapherStateFocus,
    configureGrapherStateForLayout,
    configureGrapherStateSelection,
    configureGrapherStateTab,
    getSortedGrapherTabsForChartHit,
    getTotalColumnCount,
    pickDisplayEntities,
    getTableRowCountForGridSlot,
    makeSlotClassNames,
    extractTableSlot,
    getPreviewType,
    constructChartAndPreviewUrlsForTab,
} from "./SearchChartHitRichDataHelpers.js"
import {
    pickInitialTableSlotForMediumVariant,
    calculateMediumVariantLayout,
} from "./SearchChartHitRichDataMediumVariantHelpers.js"
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
    pickInitialTableSlotForLargeVariant,
    calculateLargePreviewImageDimensions,
    calculateLargeVariantLayout,
} from "./SearchChartHitRichDataLargeVariantHelpers.js"
import { QueryStatus, useQuery } from "@tanstack/react-query"
import { chartHitQueryKeys } from "./queries.js"
import { fetchJson } from "@ourworldindata/utils"
import { useQueryChartInfo } from "./SearchChartHitSmallHelpers.js"

// Keep in sync with $num-rows-per-column in SearchChartHitRichData.scss
const NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_MEDIUM_VARIANT = 4
const NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_LARGE_VARIANT = 10

export function SearchChartHitRichData({
    hit,
    selectedRegionNames,
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

    // Entities available for the chart
    const availableEntities =
        hit.originalAvailableEntities ?? hit.availableEntities

    // Entities selected by the user
    const pickedEntities = useMemo(
        () => pickEntitiesForChartHit(hit, selectedRegionNames),
        [hit, selectedRegionNames]
    )

    // Intersection observer for lazy loading config and data
    const { ref, isIntersecting: hasBeenVisible } = useIntersectionObserver({
        rootMargin: "400px", // Start loading 400px before visible
        freezeOnceVisible: true, // Only trigger once
    })

    // Fetch the grapher config
    const { data: chartConfig, status: loadingStatusConfig } =
        useQueryChartConfig(hit, { enabled: hasBeenVisible })

    // Fetch info for the data value display
    const entityForDataDisplay = pickedEntities[0] ?? WORLD_ENTITY_NAME
    const { data: chartInfo } = useQueryChartInfo({
        hit,
        entities: [entityForDataDisplay],
        enabled: hasBeenVisible,
    })

    // Init the grapher state
    const grapherState = useMemo(
        () => new GrapherState(chartConfig ?? { isConfigReady: false }),
        [chartConfig]
    )

    // Find Grapher tabs to display and bring them in the right order
    const sortedTabs = getSortedGrapherTabsForChartHit(grapherState)

    // Choose the entities to display
    const displayEntities = findDisplayEntitiesForChartHit(
        variant,
        grapherState,
        {
            pickedEntities,
            availableEntities,
            chartInfo,
            sortedTabs,
            entityForDataDisplay,
            numDataTableRowsPerColumn,
        }
    )

    // Bring Grapher into the right state for this search result:
    // - Set the tab to the leftmost tab in the sorted list
    // - Select the entities determined for this search result
    // - Highlight the entity (or entities) the user picked
    runInAction(() => {
        configureGrapherStateTab(grapherState, { tab: sortedTabs[0] })
        configureGrapherStateSelection(grapherState, {
            entities: displayEntities,
        })
        configureGrapherStateFocus(grapherState, { entities: pickedEntities })
    })

    // Fetch the data table's content
    const { data: dataTableContent, status: loadingStatusTableContent } =
        useQueryDataTableContent(hit, grapherState.changedParams, {
            enabled: hasBeenVisible && grapherState.isConfigReady,
        })

    const layout = calculateLayout(variant, grapherState, {
        chartInfo,
        dataTableContent,
        sortedTabs,
        entityForDataDisplay,
        numDataTableRowsPerColumn,
    })
    const tableSlot = extractTableSlot(layout?.placedTabs ?? [])

    // We might need to adjust entity selection and focus according to the chosen layout
    if (layout && tableSlot)
        runInAction(() => {
            configureGrapherStateForLayout(grapherState, {
                dataTableContent: layout.dataTableContent,
                numAvailableDataTableRows: getTableRowCountForGridSlot(
                    tableSlot,
                    numDataTableRowsPerColumn
                ),
                maxNumEntitiesInStackedDiscreteBarChart:
                    variant === "large" ? 12 : 6,
            })
        })

    const status = combineStatuses(
        loadingStatusConfig,
        loadingStatusTableContent
    )

    // Render the fallback component if config or data loading failed
    if (status === "error") {
        return (
            <SearchChartHitRichDataFallback
                hit={hit}
                selectedRegionNames={selectedRegionNames}
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
                    isLarge={isLargeVariant}
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
    const sourcesUrl = constructChartUrl({
        hit,
        grapherParams,
        overlay: "sources",
    })
    const downloadUrl = constructChartUrl({
        hit,
        grapherParams,
        overlay: "download-data",
    })

    const contentStyle = {
        "--num-columns": getTotalColumnCount(layout?.placedTabs ?? []),
    } as React.CSSProperties

    return (
        <div ref={ref} className="search-chart-hit-rich-data">
            <div className="search-chart-hit-rich-data__header">
                <SearchChartHitHeader
                    hit={hit}
                    url={chartUrl}
                    source={chartInfo?.source}
                    isLarge={isLargeVariant}
                    onClick={onClick}
                />
                <div className="search-chart-hit-rich-data__header-actions">
                    {isLargeVariant && (
                        <Button
                            text="Learn more about this data"
                            className="search-chart-hit-rich-data__button"
                            theme="outline-light-blue"
                            href={sourcesUrl}
                            icon={null}
                        />
                    )}
                    <Button
                        text="Download options"
                        className="search-chart-hit-rich-data__button"
                        theme="solid-light-blue"
                        href={downloadUrl}
                        icon={faDownload}
                        iconPosition="left"
                        dataTrackNote="search-download-options"
                    />
                </div>
            </div>

            <div
                className={cx(
                    "search-chart-hit-rich-data__content",
                    `search-chart-hit-rich-data__content--${variant}`
                )}
                style={contentStyle}
            >
                {layout?.placedTabs.map(({ tab, slot }, tabIndex) => {
                    const isPrimaryTab = tabIndex === 0
                    const isSmallSlot =
                        slot === MediumVariantGridSlot.SmallLeft ||
                        slot === MediumVariantGridSlot.SmallRight

                    // Always use the complete version on smaller screens since
                    // the table might not be visible
                    const minimalThumbnail = {
                        variant: PreviewVariant.Thumbnail,
                        isMinimal: false,
                    }
                    const previewType = isMediumScreen
                        ? minimalThumbnail
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

                    const className = makeSlotClassNames(variant, slot)

                    return tab === GRAPHER_TAB_NAMES.Table ? (
                        <CaptionedTable
                            key={tab}
                            chartUrl={chartUrl}
                            dataTableContent={dataTableContent}
                            numAvailableEntities={availableEntities.length}
                            numRowsPerColumn={numDataTableRowsPerColumn}
                            entityType={grapherState.entityType}
                            entityTypePlural={grapherState.entityTypePlural}
                            className={className}
                            onClick={() => onClick(tab)}
                        />
                    ) : (
                        <CaptionedThumbnail
                            key={tab}
                            chartType={tab}
                            isSmallSlot={isSmallSlot}
                            chartUrl={chartUrl}
                            previewUrl={previewUrl}
                            imageWidth={imageWidth}
                            imageHeight={imageHeight}
                            className={className}
                            onClick={() => onClick(tab)}
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

function combineStatuses(...statuses: QueryStatus[]): QueryStatus {
    return statuses.includes("error")
        ? "error"
        : statuses.includes("loading")
          ? "loading"
          : "success"
}

function calculateLayout(
    variant: RichDataComponentVariant,
    grapherState: GrapherState,
    args: {
        chartInfo?: GrapherValuesJson
        dataTableContent?: SearchChartHitDataTableContent
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

function findDisplayEntitiesForChartHit(
    variant: RichDataComponentVariant,
    grapherState: GrapherState,
    {
        pickedEntities,
        availableEntities,
        chartInfo,
        sortedTabs,
        entityForDataDisplay,
        numDataTableRowsPerColumn,
    }: {
        pickedEntities: EntityName[]
        availableEntities: EntityName[]
        sortedTabs: GrapherTabName[]
        chartInfo?: GrapherValuesJson
        entityForDataDisplay?: EntityName
        numDataTableRowsPerColumn: number
    }
): EntityName[] {
    // Choose the entities to display
    const displayEntities = pickDisplayEntities(grapherState, {
        pickedEntities,
        availableEntities,
    })

    // Find the slot available to the table
    const tableSlot = pickInitialTableSlot(variant, grapherState, {
        chartInfo,
        sortedTabs,
        entityForDataDisplay,
        numDataTableRowsPerColumn,
    })
    if (!tableSlot) return displayEntities

    const numAvailableDataTableRows = getTableRowCountForGridSlot(
        tableSlot,
        numDataTableRowsPerColumn
    )

    // Drop entities if there are too many to fit into the table
    if (
        numAvailableDataTableRows > 0 &&
        displayEntities.length > numAvailableDataTableRows
    ) {
        return R.take(displayEntities, numAvailableDataTableRows)
    }

    return displayEntities
}

function pickInitialTableSlot(
    variant: RichDataComponentVariant,
    grapherState: GrapherState,
    args: {
        chartInfo?: GrapherValuesJson
        sortedTabs: GrapherTabName[]
        entityForDataDisplay?: EntityName
        numDataTableRowsPerColumn: number
    }
): GridSlot | undefined {
    return match(variant)
        .with("large", () =>
            pickInitialTableSlotForLargeVariant(grapherState, args)
        )
        .with("medium", () =>
            pickInitialTableSlotForMediumVariant(grapherState, args)
        )
        .exhaustive()
}

/** Fetches the Grapher config for a given chart hit */
function useQueryChartConfig(
    hit: SearchChartHit,
    { enabled }: { enabled?: boolean } = {}
): {
    data?: GrapherInterface
    status: QueryStatus
} {
    const isChartRecord = hit.type === ChartRecordType.Chart

    const { data: fetchedChartConfig, status } = useQuery({
        queryKey: chartHitQueryKeys.chartConfig(
            hit.slug,
            isChartRecord ? undefined : hit.queryParams
        ),
        queryFn: () => {
            const configUrl = constructConfigUrl({ hit })
            if (!configUrl) return null
            return fetchJson<GrapherInterface>(configUrl)
        },
        enabled,
    })

    // If the result is null, the query URL couldn't be constructed. In this
    // case, return an error status instead of a success status with null data
    if (fetchedChartConfig === null) return { status: "error" }

    const chartConfig = fetchedChartConfig
        ? migrateGrapherConfigToLatestVersion(fetchedChartConfig)
        : undefined

    return { data: chartConfig, status }
}

function useQueryDataTableContent(
    hit: SearchChartHit,
    grapherParams: GrapherQueryParams,
    { enabled }: { enabled?: boolean }
): {
    data?: SearchChartHitDataTableContent
    status: QueryStatus
} {
    const { data: dataTableContent, status } = useQuery({
        queryKey: chartHitQueryKeys.tableContent(
            hit.slug,
            hit.type === ChartRecordType.Chart ? undefined : hit.queryParams,
            grapherParams
        ),
        queryFn: () => {
            const configUrl = constructSearchTableUrl({
                hit,
                grapherParams,
            })
            if (!configUrl) return null
            return fetchJson<SearchChartHitDataTableContent>(configUrl)
        },
        enabled,
    })

    // If the result is null, the query URL couldn't be constructed. In this
    // case, return an error status instead of a success status with null data
    if (dataTableContent === null) return { status: "error" }

    return { data: dataTableContent, status }
}
