import * as _ from "lodash-es"
import { useRef, useMemo, useContext, useEffect } from "react"
import {
    grapherInterfaceWithHiddenControls,
    grapherInterfaceWithHiddenTabs,
    GrapherProgrammaticInterface,
    GuidedChartContext,
} from "@ourworldindata/grapher"
import {
    ChartControlKeyword,
    ChartTabKeyword,
    EnrichedBlockChart,
    Url,
    excludeUndefined,
} from "@ourworldindata/utils"
import { ChartConfigType, GRAPHER_PREVIEW_CLASS } from "@ourworldindata/types"
import { useLinkedChart } from "../utils.js"
import SpanElements from "./SpanElements.js"
import cx from "classnames"
import { GrapherWithFallback } from "../../GrapherWithFallback.js"
import { MultiDimEmbed } from "../../MultiDimEmbed.js"
import { useEmbedChart } from "../../hooks.js"
import { DocumentContext } from "../DocumentContext.js"

export default function Chart({
    d,
    className,
    fullWidthOnMobile = false,
}: {
    d: EnrichedBlockChart
    className?: string
    fullWidthOnMobile?: boolean
}) {
    const { isPreviewing } = useContext(DocumentContext)
    const refChartContainer = useRef<HTMLDivElement>(null)
    useEmbedChart(0, refChartContainer, isPreviewing)

    // Connect chart ref to GuidedChartContext for guided chart scrollTo on mobile
    const guidedChartContext = useContext(GuidedChartContext)
    useEffect(() => {
        if (guidedChartContext?.chartRef && refChartContainer.current) {
            guidedChartContext.chartRef.current = refChartContainer.current
        }
    }, [guidedChartContext])

    // d.url may use an old slug that has since had a redirect created for it
    // useLinkedChart references a hashmap that has resolved these old slugs to their current chart
    // It also extracts the queryString from d.url (if present) and appends it to linkedChart.resolvedUrl
    // This means we can link to the same chart multiple times with different querystrings
    // and it should all resolve correctly via the same linkedChart
    const { linkedChart } = useLinkedChart(d.url)

    const url = Url.fromURL(d.url)
    const resolvedUrl = linkedChart?.resolvedUrl
    const resolvedUrlParsed = Url.fromURL(resolvedUrl ?? "")
    const slug = resolvedUrlParsed.slug!
    const queryStr = resolvedUrlParsed.queryStr
    const isExplorer = linkedChart?.configType === ChartConfigType.Explorer
    const isMultiDim = linkedChart?.configType === ChartConfigType.MultiDim
    const hasControls = url.queryParams.hideControls !== "true"
    const isExplorerWithControls = isExplorer && hasControls
    const isMultiDimWithControls = isMultiDim && hasControls

    // config passed to grapher charts
    const customizedChartConfig = useMemo(() => {
        let config: GrapherProgrammaticInterface = {}
        const isCustomized = d.title || d.subtitle
        if (!isExplorer && isCustomized) {
            const controls: ChartControlKeyword[] = d.controls || []
            const tabs: ChartTabKeyword[] = d.tabs || []

            const showAllControls = controls.includes(ChartControlKeyword.all)
            const showAllTabs = tabs.includes(ChartTabKeyword.all)

            const allControlsHidden = grapherInterfaceWithHiddenControls
            const allTabsHidden = grapherInterfaceWithHiddenTabs

            const enabledControls = excludeUndefined(
                controls.map(mapControlKeywordToGrapherConfig)
            )
            const enabledTabs = excludeUndefined(
                tabs.map(mapTabKeywordToGrapherConfig)
            )

            config = _.merge(
                {},
                !showAllControls ? allControlsHidden : {},
                !showAllTabs ? allTabsHidden : {},
                ...enabledControls,
                ...enabledTabs,
                {
                    hideRelatedQuestion: true,
                    hideShareButton: true, // always hidden since the original chart would be shared, not the customized one
                    hideExploreTheDataButton: false,
                },
                {
                    title: d.title,
                    subtitle: d.subtitle,
                }
            )

            // make sure the custom title is presented as is
            if (config.title) {
                config.forceHideAnnotationFieldsInTitle = {
                    entity: true,
                    time: true,
                    changeInPrefix: true,
                }
            }
        }
        return config
    }, [d.title, d.subtitle, d.controls, d.tabs, isExplorer])

    const chartConfig = useMemo(
        () => ({
            archiveContext: linkedChart?.archivedPageVersion,
            ...customizedChartConfig,
        }),
        [linkedChart?.archivedPageVersion, customizedChartConfig]
    )

    if (!linkedChart) return null
    return (
        <div
            className={cx(d.position, className, {
                "full-width-on-mobile":
                    !isExplorerWithControls && fullWidthOnMobile,
            })}
            style={{ gridRow: d.row, gridColumn: d.column }}
            ref={refChartContainer}
        >
            {isExplorer ? (
                <figure
                    // Use unique `key` to force React to re-render tree
                    key={resolvedUrl}
                    className={cx({
                        [GRAPHER_PREVIEW_CLASS]: !isExplorer,
                        chart:
                            !isExplorerWithControls && !isMultiDimWithControls,
                        explorer: isExplorerWithControls,
                        "multi-dim": isMultiDimWithControls,
                    })}
                    data-is-multi-dim={isMultiDim || undefined}
                    data-grapher-src={isExplorer ? undefined : resolvedUrl}
                    data-grapher-config={
                        isExplorer || _.isEmpty(chartConfig)
                            ? undefined
                            : JSON.stringify(chartConfig)
                    }
                    data-explorer-src={isExplorer ? resolvedUrl : undefined}
                    style={{
                        width: "100%",
                        border: "0px none",
                        height: d.height,
                    }}
                >
                    <div className="js--show-warning-block-if-js-disabled" />
                </figure>
            ) : isMultiDim ? (
                <MultiDimEmbed
                    url={d.url}
                    chartConfig={chartConfig}
                    isPreviewing={isPreviewing}
                />
            ) : (
                <GrapherWithFallback
                    slug={slug}
                    config={chartConfig}
                    queryStr={queryStr}
                    isEmbeddedInAnOwidPage={true}
                    isEmbeddedInADataPage={false}
                    isPreviewing={isPreviewing}
                />
            )}
            {d.caption ? (
                <figcaption>
                    <SpanElements spans={d.caption} />
                </figcaption>
            ) : null}
        </div>
    )
}

const mapControlKeywordToGrapherConfig = (
    keyword: ChartControlKeyword
): GrapherProgrammaticInterface | undefined => {
    switch (keyword) {
        case ChartControlKeyword.relativeToggle:
            return { hideRelativeToggle: false }

        case ChartControlKeyword.timeline:
            return { hideTimeline: false, map: { hideTimeline: false } }

        case ChartControlKeyword.facetControl:
            return { hideFacetControl: false }

        case ChartControlKeyword.entitySelector:
            return { hideEntityControls: false }

        case ChartControlKeyword.zoomToggle:
            return { hideZoomToggle: false }

        case ChartControlKeyword.noDataAreaToggle:
            return { hideNoDataAreaToggle: false }

        case ChartControlKeyword.alignAxisScalesToggle:
            return { hideFacetYDomainToggle: false }

        case ChartControlKeyword.xLogLinearSelector:
            return { hideXScaleToggle: false }

        case ChartControlKeyword.yLogLinearSelector:
            return { hideYScaleToggle: false }

        case ChartControlKeyword.mapRegionDropdown:
            return { hideMapRegionDropdown: false }

        default:
            return undefined
    }
}

const mapTabKeywordToGrapherConfig = (
    keyword: ChartTabKeyword
): GrapherProgrammaticInterface | undefined => {
    switch (keyword) {
        case ChartTabKeyword.table:
            return { hasTableTab: true }

        case ChartTabKeyword.map:
            return { hasMapTab: true }

        case ChartTabKeyword.chart:
            return { hideChartTabs: false }

        default:
            return undefined
    }
}
