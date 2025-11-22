import { useContext } from "react"
import urljoin from "url-join"
import cx from "classnames"
import {
    EnrichedBlockAllCharts,
    RelatedChart,
    Url,
    ALL_CHARTS_ID,
    KeyChartLevel,
    queryParamsToStr,
} from "@ourworldindata/utils"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { RelatedCharts } from "../../blocks/RelatedCharts.js"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { Button } from "@ourworldindata/components"
import { match } from "ts-pattern"
import { SearchChartHitComponent } from "../../search/SearchChartHitComponent.js"
import {
    ChartRecordType,
    SearchChartHit,
    SearchChartHitComponentVariant,
} from "../../search/searchTypes.js"

type AllChartsProps = EnrichedBlockAllCharts & {
    className?: string
}

const toSearchChartHit = (
    chart: RelatedChart,
    position: number
): SearchChartHit => {
    return {
        type: ChartRecordType.Chart,
        objectID: chart.objectID,
        slug: chart.slug,
        title: chart.title,
        variantName: chart.variantName ?? undefined,
        subtitle: chart.subtitle,
        availableTabs: chart.availableTabs,
        availableEntities: chart.availableEntities,
        originalAvailableEntities: chart.originalAvailableEntities,
        __position: position,
    }
}

function sortRelatedCharts(
    relatedCharts: RelatedChart[],
    sortedSlugs: string[]
): RelatedChart[] {
    const sortedRelatedCharts: RelatedChart[] = []

    // (We don't know if these slugs actually exist in relatedCharts)
    // Try to find them in order and put them at the front of the list
    sortedSlugs.forEach((slug) => {
        const index = relatedCharts.findIndex((chart) => chart.slug === slug)
        if (index !== -1) {
            const relatedChart = relatedCharts.splice(index, 1)[0]
            if (relatedChart) {
                // a teeny hack to stop the RelatedCharts component from
                // sorting these charts below the other key charts
                relatedChart.keyChartLevel = KeyChartLevel.Top
                sortedRelatedCharts.push(relatedChart)
            }
        }
    })

    sortedRelatedCharts.push(...relatedCharts)

    return sortedRelatedCharts
}

export function AllCharts(props: AllChartsProps) {
    const { heading, top, className, layout = "grid" } = props
    const { relatedCharts, tags } = useContext(AttachmentsContext)
    if (relatedCharts.length === 0) return null

    const layoutModifierClass = `article-block__all-charts--${layout}`

    const topSlugs = top.map((item) => Url.fromURL(item.url).slug as string)

    const firstTag = tags[0]
    const firstTagDataCatalogQueryString = firstTag
        ? queryParamsToStr({ topics: firstTag.name })
        : ""

    const sortedRelatedCharts = sortRelatedCharts(relatedCharts, topSlugs)

    const seeAllButton = (
        <Button
            theme="solid-vermillion"
            text="See all charts on this topic"
            href={`${urljoin(BAKED_BASE_URL, `/data`, firstTagDataCatalogQueryString)}`}
        />
    )

    return (
        <div className={cx(className, layoutModifierClass)}>
            <h1
                className="article-block__heading h1-semibold"
                id={ALL_CHARTS_ID}
            >
                <span>
                    {firstTag ? `Key Charts on ${firstTag.name}` : heading}
                </span>
                <a
                    className="deep-link"
                    aria-labelledby={ALL_CHARTS_ID}
                    href={`#${ALL_CHARTS_ID}`}
                />
            </h1>
            {match(layout)
                .with("grid", () => (
                    <>
                        {seeAllButton}
                        <RelatedCharts
                            showKeyChartsOnly={true}
                            charts={sortedRelatedCharts}
                        />
                    </>
                ))
                .with("list", () => (
                    <>
                        <ul className="search-data-results__list">
                            {sortedRelatedCharts
                                .slice(0, 8)
                                .map((chart, idx) => {
                                    const variant: SearchChartHitComponentVariant =
                                        idx < 4 ? "medium" : "small"

                                    const hit = toSearchChartHit(chart, idx + 1)

                                    const onClick = (
                                        _vizType: string | null
                                    ) => {
                                        // TODO
                                        // analytics.logSiteSearchResultClick(hit, {
                                        //     position: hitIndex + 1,
                                        //     source: "search",
                                        //     vizType,
                                        // })
                                    }

                                    return (
                                        <li
                                            className="search-data-results__hit"
                                            key={chart.slug}
                                        >
                                            <SearchChartHitComponent
                                                hit={hit}
                                                variant={variant}
                                                onClick={onClick}
                                            />
                                        </li>
                                    )
                                })}
                        </ul>
                        {seeAllButton}
                    </>
                ))
                .exhaustive()}
        </div>
    )
}
