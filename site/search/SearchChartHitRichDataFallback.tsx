import { useIntersectionObserver } from "usehooks-ts"
import { SearchChartHitComponentProps } from "./searchTypes.js"
import { useMemo } from "react"
import cx from "classnames"
import {
    constructChartUrl,
    pickEntitiesForChartHit,
    toGrapherQueryParams,
} from "./searchUtils.js"
import { WORLD_ENTITY_NAME } from "@ourworldindata/grapher"
import {
    buildChartHitDataDisplayProps,
    GRAPHER_TAB_NAMES,
    GrapherChartType,
    placeGrapherTabsInMediumVariantGridLayout,
} from "@ourworldindata/utils"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"
import { Button } from "@ourworldindata/components"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { CaptionedThumbnail } from "./SearchChartHitCaptionedThumbnail.js"
import { SearchChartHitDataDisplay } from "./SearchChartHitDataDisplay.js"
import {
    getTotalColumnCount,
    makeSlotClassNames,
} from "./SearchChartHitRichDataHelpers.js"
import {
    constructChartAndPreviewUrlsForTab,
    useQueryChartInfo,
} from "./SearchChartHitSmallHelpers.js"

export function SearchChartHitRichDataFallback({
    hit,
    selectedRegionNames,
    onClick,
}: SearchChartHitComponentProps) {
    const hasScatter = hit.availableTabs.includes(GRAPHER_TAB_NAMES.ScatterPlot)

    // Intersection observer for lazy loading chart info
    const { ref, isIntersecting: hasBeenVisible } = useIntersectionObserver({
        rootMargin: "400px", // Start loading 400px before visible
        freezeOnceVisible: true, // Only trigger once
    })

    const entities = useMemo(
        () => pickEntitiesForChartHit(hit, selectedRegionNames),
        [hit, selectedRegionNames]
    )

    const entityForDisplay = entities[0] ?? WORLD_ENTITY_NAME
    const hasUserPickedEntities = entities.length > 0

    const entityParam = toGrapherQueryParams({ entities })
    const chartUrl = constructChartUrl({ hit, grapherParams: entityParam })

    // Fetch chart info and data values
    const { data: chartInfo } = useQueryChartInfo({
        hit,
        entities,
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
    const placedTabs = placeGrapherTabsInMediumVariantGridLayout(grapherTabs, {
        hasDataDisplay: !!dataDisplayProps,
        hasDataTable: false,
    })

    const contentStyle = {
        "--num-columns": getTotalColumnCount(placedTabs),
    } as React.CSSProperties

    return (
        <div ref={ref} className="search-chart-hit-rich-data">
            <div className="search-chart-hit-rich-data__header">
                <SearchChartHitHeader
                    hit={hit}
                    url={chartUrl}
                    source={chartInfo?.source}
                    onClick={onClick}
                />
                <div className="search-chart-hit-rich-data__header-actions">
                    <Button
                        text="Download options"
                        className="search-chart-hit-rich-data__button"
                        theme="solid-light-blue"
                        href={constructChartUrl({
                            hit,
                            overlay: "download-data",
                        })}
                        icon={faDownload}
                        iconPosition="left"
                        dataTrackNote="search-download-options"
                    />
                </div>
            </div>

            <div
                className={cx(
                    "search-chart-hit-rich-data__content",
                    "search-chart-hit-rich-data__content--medium",
                    {
                        "search-chart-hit-rich-data__content--scatter":
                            hasScatter,
                    }
                )}
                style={contentStyle}
            >
                {placedTabs.map(({ grapherTab, slotKey }) => {
                    const { chartUrl, previewUrl } =
                        constructChartAndPreviewUrlsForTab({
                            hit,
                            tab: grapherTab,
                            chartInfo,
                            entities,
                            hasScatter,
                        })

                    const className = makeSlotClassNames("medium", slotKey)

                    return (
                        <CaptionedThumbnail
                            key={grapherTab}
                            chartType={grapherTab}
                            chartUrl={chartUrl}
                            previewUrl={previewUrl}
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
