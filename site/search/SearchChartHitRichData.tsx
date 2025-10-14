import * as R from "remeda"
import { useMemo } from "react"
import cx from "classnames"
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { match } from "ts-pattern"
import {
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
    mapGrapherTabNameToQueryParam,
} from "@ourworldindata/grapher"
import {
    EntityName,
    GRAPHER_TAB_NAMES,
    GrapherTabName,
    GridSlotKey,
    LargeVariantGridSlotKey,
    MediumVariantGridSlotKey,
    LayoutSlot,
    GrapherSearchResultJson,
    GrapherQueryParams,
} from "@ourworldindata/types"
import { Button } from "@ourworldindata/components"
import { MEDIUM_BREAKPOINT_MEDIA_QUERY } from "../SiteConstants.js"
import {
    ChartRecordType,
    SearchChartHit,
    SearchChartHitComponentProps,
    SearchChartHitComponentVariant,
} from "./searchTypes.js"
import {
    constructChartUrl,
    constructPreviewUrl,
    constructSearchResultUrl,
    pickEntitiesForChartHit,
} from "./searchUtils.js"
import {
    getTotalColumnCount,
    makeSlotClassNames,
    getPreviewType,
    calculateScatterPreviewImageDimensions,
} from "./SearchChartHitRichDataHelpers.js"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"
import { CaptionedTable } from "./SearchChartHitCaptionedTable.js"
import { CaptionedThumbnail } from "./SearchChartHitCaptionedThumbnail.js"
import { SearchChartHitDataDisplay } from "./SearchChartHitDataDisplay.js"
import { SearchChartHitRichDataFallback } from "./SearchChartHitRichDataFallback.js"
import {
    PreviewVariant,
    RichDataComponentVariant,
} from "./SearchChartHitRichDataTypes.js"
import { QueryStatus, useQuery } from "@tanstack/react-query"
import { chartHitQueryKeys } from "./queries.js"
import { fetchJson } from "@ourworldindata/utils"

// Keep in sync with $num-rows-per-column in SearchChartHitRichData.scss
const NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_MEDIUM_VARIANT = 4
const NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_LARGE_VARIANT = 10

// Keep in sync with $scatter-num-data-table-rows-per-column in SearchChartHitRichData.scss
const SCATTER_NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_MEDIUM_VARIANT = 6

export function SearchChartHitRichData({
    hit,
    selectedRegionNames,
    onClick,
    variant,
}: SearchChartHitComponentProps & {
    variant: RichDataComponentVariant
}) {
    const isMediumScreen = useMediaQuery(MEDIUM_BREAKPOINT_MEDIA_QUERY)

    // Determine the maximum number of data table rows per column
    const isLargeVariant = variant === "large"
    const hasScatter = hit.availableTabs.includes(GRAPHER_TAB_NAMES.ScatterPlot)
    const numDataTableRowsPerColumn = isLargeVariant
        ? NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_LARGE_VARIANT
        : hasScatter
          ? SCATTER_NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_MEDIUM_VARIANT
          : NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_MEDIUM_VARIANT

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

    // Fetch search result data for this chart hit
    const { data, status: loadingStatus } = useQuerySearchResultDataForChartHit(
        {
            hit,
            params: {
                version: 1,
                variant,
                entities: pickedEntities,
                numDataTableRowsPerColumn,
            },
            enabled: hasBeenVisible,
        }
    )

    // Render the fallback component if config or data loading failed
    if (loadingStatus === "error") {
        return (
            <SearchChartHitRichDataFallback
                hit={hit}
                selectedRegionNames={selectedRegionNames}
                onClick={onClick}
            />
        )
    }

    // Render a placeholder component while the config and data are loading
    if (loadingStatus === "pending" || data === undefined) {
        const chartUrl = constructChartUrl({ hit })
        const sourcesUrl = constructChartUrl({ hit, overlay: "sources" })
        const downloadUrl = constructChartUrl({ hit, overlay: "download-data" })

        return (
            <div ref={ref} className="search-chart-hit-rich-data">
                <div className="search-chart-hit-rich-data__header">
                    <SearchChartHitHeader
                        hit={hit}
                        url={chartUrl}
                        isLarge={isLargeVariant}
                        onClick={onClick}
                    />
                    <SearchChartHitHeaderActionButtons
                        isLarge={isLargeVariant}
                        sourcesUrl={sourcesUrl}
                        downloadUrl={downloadUrl}
                    />
                </div>
                <RichDataContentPlaceholder
                    variant={variant}
                    hasScatter={hasScatter}
                />
            </div>
        )
    }

    const countryParam = R.pick(data.grapherQueryParams, ["country"])
    const chartUrl = constructChartUrl({ hit, grapherParams: countryParam })
    const sourcesUrl = constructChartUrl({
        hit,
        grapherParams: countryParam,
        overlay: "sources",
    })
    const downloadUrl = constructChartUrl({
        hit,
        grapherParams: countryParam,
        overlay: "download-data",
    })

    const contentStyle = {
        "--num-columns": getTotalColumnCount(data.layout),
    } as React.CSSProperties

    return (
        <div ref={ref} className="search-chart-hit-rich-data">
            <div className="search-chart-hit-rich-data__header">
                <SearchChartHitHeader
                    hit={hit}
                    title={data.title}
                    subtitle={data.subtitle}
                    url={chartUrl}
                    source={data.source}
                    isLarge={isLargeVariant}
                    onClick={onClick}
                />
                <SearchChartHitHeaderActionButtons
                    isLarge={isLargeVariant}
                    sourcesUrl={sourcesUrl}
                    downloadUrl={downloadUrl}
                />
            </div>

            <div
                className={cx(
                    "search-chart-hit-rich-data__content",
                    `search-chart-hit-rich-data__content--${variant}`,
                    {
                        "search-chart-hit-rich-data__content--scatter":
                            hasScatter,
                    }
                )}
                style={contentStyle}
            >
                {data.layout.map(
                    ({ grapherTab, slotKey, chartParams }, tabIndex) => {
                        const isSmallSlot =
                            slotKey === MediumVariantGridSlotKey.SmallLeft ||
                            slotKey === MediumVariantGridSlotKey.SmallRight

                        const chartUrl = constructChartUrlForTab({
                            hit,
                            grapherTab,
                            primaryGrapherTab: data.layout[0].grapherTab,
                            grapherQueryParams: data.grapherQueryParams,
                            overwriteParams: chartParams,
                        })

                        const { previewUrl, imageWidth, imageHeight } =
                            constructPreviewUrlForTab({
                                hit,
                                grapherQueryParams: data.grapherQueryParams,
                                variant,
                                layout: data.layout,
                                slotIndex: tabIndex,
                                isMediumScreen,
                                hasScatter,
                            })

                        const className = makeSlotClassNames(variant, slotKey)

                        return grapherTab === GRAPHER_TAB_NAMES.Table ? (
                            <CaptionedTable
                                key={grapherTab}
                                chartUrl={chartUrl}
                                dataTableContent={data.dataTable}
                                numAvailableEntities={availableEntities.length}
                                numRowsPerColumn={numDataTableRowsPerColumn}
                                entityType={data.entityType}
                                entityTypePlural={data.entityTypePlural}
                                className={className}
                                onClick={() => onClick(grapherTab)}
                            />
                        ) : (
                            <CaptionedThumbnail
                                key={grapherTab}
                                chartType={grapherTab}
                                isSmallSlot={isSmallSlot}
                                chartUrl={chartUrl}
                                previewUrl={previewUrl}
                                imageWidth={imageWidth}
                                imageHeight={imageHeight}
                                className={className}
                                onClick={() => onClick(grapherTab)}
                            />
                        )
                    }
                )}

                {data.valueDisplay && (
                    <SearchChartHitDataDisplay
                        className="data-slot"
                        {...data.valueDisplay}
                    />
                )}
            </div>
        </div>
    )
}

function SearchChartHitHeaderActionButtons({
    isLarge,
    sourcesUrl,
    downloadUrl,
}: {
    isLarge: boolean
    sourcesUrl: string
    downloadUrl: string
}): React.ReactElement {
    return (
        <div className="search-chart-hit-rich-data__header-actions">
            {isLarge && (
                <Button
                    text="Learn more about this data"
                    className="search-chart-hit-rich-data__button"
                    theme="outline-light-blue"
                    href={sourcesUrl}
                    icon={null}
                    dataTrackNote="search-sources-modal"
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
    )
}

function RichDataContentPlaceholder({
    variant,
    hasScatter,
}: {
    variant: RichDataComponentVariant
    hasScatter: boolean
}): React.ReactElement {
    return match(variant)
        .with("medium", () => (
            <RichDataContentMediumVariantPlaceholder hasScatter={hasScatter} />
        ))
        .with("large", () => <RichDataContentLargeVariantPlaceholder />)
        .exhaustive()
}

function RichDataContentMediumVariantPlaceholder({
    hasScatter,
}: {
    hasScatter: boolean
}): React.ReactElement {
    return (
        <div
            className={cx(
                "search-chart-hit-rich-data__content",
                "search-chart-hit-rich-data__content--medium",
                { "search-chart-hit-rich-data__content--scatter": hasScatter }
            )}
            style={{ "--num-columns": 3 } as React.CSSProperties}
        >
            <GrapherThumbnailPlaceholder
                variant="medium"
                slot={MediumVariantGridSlotKey.Single}
            />
            <GrapherThumbnailPlaceholder
                variant="medium"
                slot={MediumVariantGridSlotKey.Single}
            />
            <GrapherThumbnailPlaceholder
                variant="medium"
                slot={MediumVariantGridSlotKey.Single}
            />
        </div>
    )
}

function RichDataContentLargeVariantPlaceholder(): React.ReactElement {
    return (
        <div className="search-chart-hit-rich-data__content search-chart-hit-rich-data__content--large">
            <GrapherThumbnailPlaceholder
                variant="large"
                slot={LargeVariantGridSlotKey.LeftQuad}
            />
            <GrapherThumbnailPlaceholder
                variant="large"
                slot={LargeVariantGridSlotKey.RightQuadLeftColumn}
            />
            <GrapherThumbnailPlaceholder
                variant="large"
                slot={LargeVariantGridSlotKey.SingleCell}
            />
            <GrapherThumbnailPlaceholder
                variant="large"
                slot={LargeVariantGridSlotKey.SingleCell}
            />
        </div>
    )
}

function GrapherThumbnailPlaceholder({
    variant,
    slot,
}: {
    variant: RichDataComponentVariant
    slot: GridSlotKey
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

function useQuerySearchResultDataForChartHit({
    hit,
    params,
    enabled,
}: {
    hit: SearchChartHit
    params: {
        version: number
        entities?: EntityName[]
        variant: RichDataComponentVariant
        numDataTableRowsPerColumn: number
    }
    enabled?: boolean
}): { data?: GrapherSearchResultJson; status: QueryStatus } {
    const { data, status } = useQuery({
        queryKey: chartHitQueryKeys.searchResultData(
            hit.slug,
            hit.type === ChartRecordType.Chart ? undefined : hit.queryParams,
            params.version,
            params.variant,
            params.entities,
            params.numDataTableRowsPerColumn
        ),
        queryFn: () => {
            const url = constructSearchResultUrl({ hit, params })
            if (!url) return null
            return fetchJson<GrapherSearchResultJson>(url)
        },
        enabled,
    })

    // If the result is null, the query URL couldn't be constructed. In this
    // case, return an error status instead of a success status with null data
    if (data === null) return { status: "error" }

    // Treat an empty data table as an error
    if (data && data.dataTable.rows.length === 0) return { status: "error" }

    return { data, status }
}

function constructChartUrlForTab({
    hit,
    grapherTab,
    primaryGrapherTab,
    grapherQueryParams,
    overwriteParams,
}: {
    hit: SearchChartHit
    grapherTab: GrapherTabName
    primaryGrapherTab: GrapherTabName
    grapherQueryParams: GrapherQueryParams
    overwriteParams?: GrapherQueryParams
}): string {
    // Use Grapher's changedParams to construct chart URL.
    // We override the tab parameter because the GrapherState is currently set to
    // the first tab of the chart, but we need to generate URLs for the specific
    // tab being rendered in this preview.
    const grapherParams = {
        ...grapherQueryParams,
        ...overwriteParams,
        tab: mapGrapherTabNameToQueryParam(grapherTab),
    }

    // We don't want to link to a chart where entities are highlighted.
    const omitParamsForChartUrl: (keyof GrapherQueryParams)[] = ["focus"]

    // In case of scatters and Marimekkos, we also ignore the current
    // entity selection so that we always link to a chart with the default
    // selection.
    if (
        grapherTab === GRAPHER_TAB_NAMES.ScatterPlot ||
        grapherTab === GRAPHER_TAB_NAMES.Marimekko ||
        primaryGrapherTab === GRAPHER_TAB_NAMES.ScatterPlot ||
        primaryGrapherTab === GRAPHER_TAB_NAMES.Marimekko
    )
        omitParamsForChartUrl.push("country")

    return constructChartUrl({
        hit,
        grapherParams: R.omit(grapherParams, omitParamsForChartUrl),
    })
}

function constructPreviewUrlForTab({
    hit,
    grapherQueryParams,
    variant,
    layout,
    slotIndex,
    isMediumScreen,
    hasScatter,
}: {
    hit: SearchChartHit
    grapherQueryParams: GrapherQueryParams
    variant: SearchChartHitComponentVariant
    layout: LayoutSlot[]
    slotIndex: number
    isMediumScreen: boolean
    hasScatter: boolean
}): { previewUrl: string; imageWidth?: number; imageHeight?: number } {
    const { grapherTab, previewParams } = layout[slotIndex]

    // Always use the complete version on smaller screens since
    // the table might not be visible
    const isPrimaryTab = slotIndex === 0
    const previewType = isMediumScreen
        ? { variant: PreviewVariant.Thumbnail, isMinimal: false }
        : getPreviewType(variant, { isPrimaryTab })

    // Use Grapher's changedParams to construct preview URL.
    // We override the tab parameter because the GrapherState is currently set to
    // the first tab of the chart, but we need to generate URLs for the specific
    // tab being rendered in this preview.
    const grapherParams = {
        ...grapherQueryParams,
        tab: mapGrapherTabNameToQueryParam(grapherTab),
    }

    const { width: imageWidth, height: imageHeight } =
        previewType.variant === PreviewVariant.Large
            ? calculateLargePreviewImageDimensions(layout)
            : hasScatter
              ? calculateScatterPreviewImageDimensions()
              : {}

    // Use a smaller font size for chart types where labels or legends would
    // otherwise be too overpowering in thumbnail previews. Otherwise, rely on
    // the default
    const tabsWithSmallerFont: GrapherTabName[] = [
        GRAPHER_TAB_NAMES.WorldMap,
        GRAPHER_TAB_NAMES.DiscreteBar,
        GRAPHER_TAB_NAMES.StackedDiscreteBar,
    ]
    const fontSize =
        previewType.variant === PreviewVariant.Thumbnail &&
        tabsWithSmallerFont.includes(grapherTab)
            ? 12
            : undefined

    const previewUrl = constructPreviewUrl({
        hit,
        grapherParams: {
            ...grapherParams,
            ...previewParams,
        },
        variant: previewType.variant,
        isMinimal: previewType.isMinimal,
        fontSize,
        imageWidth,
        imageHeight,
    })

    return { previewUrl, imageWidth, imageHeight }
}

function calculateLargePreviewImageDimensions(layout: LayoutSlot[]): {
    width: number
    height: number
} {
    const slots = layout.map(({ slotKey }) => slotKey)

    if (slots.length <= 2) {
        return {
            width: 4 * GRAPHER_THUMBNAIL_WIDTH,
            height: 4 * GRAPHER_THUMBNAIL_HEIGHT,
        }
    }

    // The large chart must be a little taller to match the combined height of
    // both thumbnails plus the vertical spacing and caption text between them.
    return {
        width: 4 * GRAPHER_THUMBNAIL_WIDTH,
        height: 4 * GRAPHER_THUMBNAIL_HEIGHT + 4 * 16, // Magic number
    }
}
