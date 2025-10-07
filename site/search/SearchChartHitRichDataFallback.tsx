import { useIntersectionObserver } from "usehooks-ts"
import { SearchChartHitComponentProps } from "./searchTypes.js"
import { useMemo } from "react"
import {
    buildChartHitDataDisplayProps,
    constructChartUrl,
    pickEntitiesForChartHit,
    toGrapherQueryParams,
} from "./searchUtils.js"
import {
    makeLabelForGrapherTab,
    WORLD_ENTITY_NAME,
} from "@ourworldindata/grapher"
import { GRAPHER_TAB_NAMES, GrapherChartType } from "@ourworldindata/utils"
import { placeGrapherTabsInMediumVariantGridLayout } from "./SearchChartHitRichDataMediumVariantHelpers.js"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"
import { Button } from "@ourworldindata/components"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { CaptionedLink } from "./SearchChartHitCaptionedLink.js"
import { SearchChartHitThumbnail } from "./SearchChartHitThumbnail.js"
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
        tableType: "none", // since there is no table tab
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
                    onClick={() => onClick(chartType)}
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
                className="search-chart-hit-rich-data__content search-chart-hit-rich-data__content--medium"
                style={contentStyle}
            >
                {placedTabs.map(({ tab, slot }) => {
                    const caption = makeLabelForGrapherTab(tab, {
                        format: "long",
                    })

                    const { chartUrl, previewUrl } =
                        constructChartAndPreviewUrlsForTab({
                            hit,
                            tab,
                            chartInfo,
                            entities,
                        })

                    const className = makeSlotClassNames("medium", slot)

                    return (
                        <CaptionedLink
                            key={tab}
                            caption={caption}
                            url={chartUrl}
                            className={className}
                            onClick={() => onClick(tab)}
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
