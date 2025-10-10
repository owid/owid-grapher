import * as R from "remeda"
import { useMemo } from "react"
import cx from "classnames"
import { useIntersectionObserver, useMediaQuery } from "usehooks-ts"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { match } from "ts-pattern"
import {
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
    isChartTypeName,
    mapGrapherTabNameToQueryParam,
    WORLD_ENTITY_NAME,
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
import { buildChartHitDataDisplayProps, fetchJson } from "@ourworldindata/utils"
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

    // Fetch chart info for the big data value
    const entityForDataDisplay = pickedEntities[0] ?? WORLD_ENTITY_NAME
    const { data: chartInfo } = useQueryChartInfo({
        hit,
        entities: [entityForDataDisplay],
        // The large variant doesn't display a data value on the right
        enabled: hasBeenVisible && !isLargeVariant,
    })

    // Prepare rendering of the data display
    const chartType = data?.layout[0].grapherTab
    const dataDisplayProps =
        !isLargeVariant && chartType && isChartTypeName(chartType)
            ? buildChartHitDataDisplayProps({
                  chartInfo,
                  chartType,
                  entity: entityForDataDisplay,
                  isEntityPickedByUser: pickedEntities.length > 0,
              })
            : undefined

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
    if (loadingStatus === "loading" || data === undefined) {
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
                    source={data.source ?? chartInfo?.source}
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
                {data.layout.map(({ grapherTab, slotKey }, tabIndex) => {
                    const isSmallSlot =
                        slotKey === MediumVariantGridSlotKey.SmallLeft ||
                        slotKey === MediumVariantGridSlotKey.SmallRight

                    const chartUrl = constructChartUrlForTab({
                        hit,
                        grapherTab,
                        grapherQueryParams: data.grapherQueryParams,
                    })

                    const { previewUrl, imageWidth, imageHeight } =
                        constructPreviewUrlForTab({
                            hit,
                            grapherQueryParams: data.grapherQueryParams,
                            variant,
                            layout: data.layout,
                            slotIndex: tabIndex,
                            isMediumScreen,
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
            params.variant,
            params.entities
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

    return { data, status }
}

function constructChartUrlForTab({
    hit,
    grapherTab,
    grapherQueryParams,
}: {
    hit: SearchChartHit
    grapherTab: GrapherTabName
    grapherQueryParams: GrapherQueryParams
}): string {
    // Use Grapher's changedParams to construct chart URL.
    // We override the tab parameter because the GrapherState is currently set to
    // the first tab of the chart, but we need to generate URLs for the specific
    // tab being rendered in this preview.
    const grapherParams = {
        ...grapherQueryParams,
        tab: mapGrapherTabNameToQueryParam(grapherTab),
    }

    // We don't want to link to a chart where entities are highlighted.
    const omitParamsForChartUrl: (keyof GrapherQueryParams)[] = ["focus"]

    // In case of scatters and Marimekkos, we also ignore the current
    // entity selection so that we always link to a chart with the default
    // selection.
    if (
        grapherTab === GRAPHER_TAB_NAMES.ScatterPlot ||
        grapherTab === GRAPHER_TAB_NAMES.Marimekko
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
}: {
    hit: SearchChartHit
    grapherQueryParams: GrapherQueryParams
    variant: SearchChartHitComponentVariant
    layout: LayoutSlot[]
    slotIndex: number
    isMediumScreen: boolean
}): { previewUrl: string; imageWidth?: number; imageHeight?: number } {
    const { slotKey, grapherTab, previewParams } = layout[slotIndex]

    const isPrimaryTab = slotIndex === 0
    const isSmallSlot =
        slotKey === MediumVariantGridSlotKey.SmallLeft ||
        slotKey === MediumVariantGridSlotKey.SmallRight

    // Always use the complete version on smaller screens since
    // the table might not be visible
    const previewType = isMediumScreen
        ? { variant: PreviewVariant.Thumbnail, isMinimal: false }
        : getPreviewType(variant, { isPrimaryTab, isSmallSlot })

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
