import { useIntersectionObserver } from "usehooks-ts"
import { SearchChartHitComponentProps } from "./searchTypes.js"
import { useMemo } from "react"
import {
    buildChartHitDataDisplayProps,
    constructChartInfoUrl,
    constructChartUrl,
    constructPreviewUrl,
    getTimeBoundsForChartUrl,
    pickEntitiesForChartHit,
    toGrapherQueryParams,
} from "./searchUtils.js"
import {
    CHART_TYPES_THAT_SWITCH_TO_DISCRETE_BAR_WHEN_SINGLE_TIME,
    makeLabelForGrapherTab,
    WORLD_ENTITY_NAME,
} from "@ourworldindata/grapher"
import { useQuery } from "@tanstack/react-query"
import { chartHitQueryKeys } from "./queries.js"
import {
    fetchJson,
    GRAPHER_TAB_NAMES,
    GrapherChartType,
    GrapherValuesJson,
} from "@ourworldindata/utils"
import {
    getTotalColumnCount,
    placeGrapherTabsInMediumHitGridLayout,
} from "./SearchChartHitRichDataHelpers.js"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"
import { Button } from "@ourworldindata/components"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import { CaptionedLink } from "./SearchChartHitCaptionedLink.js"
import { SearchChartHitThumbnail } from "./SearchChartHitThumbnail.js"
import { SearchChartHitDataDisplay } from "./SearchChartHitDataDisplay.js"

export function SearchChartHitRichDataFallback({
    hit,
    searchQueryRegionsMatches,
    onClick,
}: SearchChartHitComponentProps) {
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
    const placedTabs = placeGrapherTabsInMediumHitGridLayout(grapherTabs, {
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
                    const previewUrl = constructPreviewUrl({
                        hit,
                        grapherParams,
                        variant: "thumbnail",
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
