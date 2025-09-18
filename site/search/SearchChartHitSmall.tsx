import { useMemo } from "react"
import { Tippy } from "@ourworldindata/utils"
import { GRAPHER_TAB_NAMES, GrapherChartType } from "@ourworldindata/types"
import { SearchChartHitComponentProps } from "./searchTypes.js"
import {
    constructChartUrl,
    pickEntitiesForChartHit,
    toGrapherQueryParams,
    buildChartHitDataDisplayProps,
} from "./searchUtils.js"
import { Button, GrapherTabIcon } from "@ourworldindata/components"
import { useIntersectionObserver } from "usehooks-ts"
import {
    makeLabelForGrapherTab,
    WORLD_ENTITY_NAME,
} from "@ourworldindata/grapher"
import { SearchChartHitDataDisplay } from "./SearchChartHitDataDisplay.js"
import { SearchChartHitHeader } from "./SearchChartHitHeader.js"
import { faDownload } from "@fortawesome/free-solid-svg-icons"
import {
    constructChartAndPreviewUrlsForTab,
    useQueryChartInfo,
} from "./SearchChartHitSmallHelpers.js"

export function SearchChartHitSmall({
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

    // Fetch chart info and data values
    const { data: chartInfo } = useQueryChartInfo({
        hit,
        entities: [entityForDisplay],
        // Only fetch when the component is visible
        enabled: hasBeenVisible,
    })

    // The first chart tab is the primary chart type
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

    const grapherParams = toGrapherQueryParams({ entities })
    const chartUrl = constructChartUrl({ hit, grapherParams })

    const sourcesUrl = constructChartUrl({
        hit,
        grapherParams,
        overlay: "sources",
    })

    return (
        <article ref={ref} className="search-chart-hit-small">
            <div className="search-chart-hit-small__content">
                <SearchChartHitHeader
                    hit={hit}
                    url={chartUrl}
                    source={
                        chartInfo?.source
                            ? { text: chartInfo.source, url: sourcesUrl }
                            : undefined
                    }
                    onClick={onClick}
                />
                <div className="search-chart-hit-small__tabs-container">
                    {hit.availableTabs.map((tab) => {
                        const { chartUrl } = constructChartAndPreviewUrlsForTab(
                            { hit, tab, chartInfo, entities }
                        )

                        const label = makeLabelForGrapherTab(tab, {
                            format: "long",
                        })

                        return (
                            <Tippy
                                key={tab}
                                appendTo={() => document.body}
                                className="search-chart-hit-small__tippy"
                                content={label}
                                placement="bottom"
                                theme="dark"
                            >
                                <a
                                    href={chartUrl}
                                    onClick={onClick}
                                    aria-label={label}
                                >
                                    <GrapherTabIcon tab={tab} />
                                </a>
                            </Tippy>
                        )
                    })}
                </div>
            </div>
            {dataDisplayProps && (
                <SearchChartHitDataDisplay {...dataDisplayProps} />
            )}
            <Tippy
                appendTo={() => document.body}
                className="search-chart-hit-small__tippy"
                content="Download options"
                placement="bottom"
                theme="dark"
            >
                {/* Without this wrapper element, the tippy isn't positioned correctly */}
                <div className="search-chart-hit-small__download-button-wrapper">
                    <Button
                        className="search-chart-hit-small__download-button"
                        theme="solid-light-blue"
                        href={constructChartUrl({
                            hit,
                            overlay: "download-data",
                        })}
                        icon={faDownload}
                        ariaLabel="Download options"
                    />
                </div>
            </Tippy>
        </article>
    )
}
