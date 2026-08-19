import cx from "clsx"
import { RelatedChart } from "@ourworldindata/utils"
import { ChartRecordType, SearchChartHit } from "@ourworldindata/types"
import { SearchChartHitRichData } from "./search/SearchChartHitRichData.js"
import { SiteQueryClientProvider } from "./SiteQueryClientProvider.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

export const RELATED_DATA_CHARTS_ID = "explore-related-charts"

const NUM_RELATED_CHARTS = 5

const analytics = new SiteAnalytics()

// The rich-data card is driven almost entirely by the chart's
// `.search-result.json` response, so a minimal synthesized hit is enough.
// `availableEntities`/`availableTabs` are left empty: there's no region
// selection on the data page, and the table caption's entity count now comes
// from the search-result response (numAvailableEntities).
function relatedChartToSearchChartHit(
    chart: RelatedChart,
    index: number
): SearchChartHit {
    return {
        type: ChartRecordType.Chart,
        slug: chart.slug,
        title: chart.title,
        variantName: chart.variantName ?? undefined,
        availableEntities: [],
        availableTabs: [],
        objectID: String(chart.chartId),
        __position: index,
    }
}

export const RelatedDataCharts = ({
    charts,
    className,
    id = RELATED_DATA_CHARTS_ID,
}: {
    charts: RelatedChart[]
    className?: string
    id?: string
}) => {
    if (charts.length === 0) return null

    const visibleCharts = charts.slice(0, NUM_RELATED_CHARTS)

    return (
        <SiteQueryClientProvider>
            <section className={cx("related-data-charts", className)} id={id}>
                <ul className="related-data-charts__list">
                    {visibleCharts.map((chart, index) => {
                        const hit = relatedChartToSearchChartHit(chart, index)
                        return (
                            <li
                                className="related-data-charts__hit"
                                key={chart.chartId}
                            >
                                <SearchChartHitRichData
                                    hit={hit}
                                    variant="medium"
                                    onClick={(vizType) =>
                                        analytics.logSiteClick(
                                            "related-data-charts",
                                            // `<1-indexed position>:<slug>[:<vizType>]`
                                            // — position lets us see which card
                                            // in the list was clicked.
                                            [
                                                index + 1,
                                                chart.slug,
                                                ...(vizType ? [vizType] : []),
                                            ].join(":")
                                        )
                                    }
                                />
                            </li>
                        )
                    })}
                </ul>
            </section>
        </SiteQueryClientProvider>
    )
}
