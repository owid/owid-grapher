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

type AllChartsProps = EnrichedBlockAllCharts & {
    className?: string
    id?: string
}

function sortRelatedCharts(
    relatedCharts: RelatedChart[],
    sortedSlugs: string[]
): RelatedChart[] {
    const chartBySlug = new Map(
        relatedCharts.map((chart) => [chart.slug, chart])
    )

    const topCharts: RelatedChart[] = []
    for (const slug of new Set(sortedSlugs)) {
        const chart = chartBySlug.get(slug)
        if (chart) {
            topCharts.push({ ...chart, keyChartLevel: KeyChartLevel.Top })
            chartBySlug.delete(slug)
        }
    }

    return [...topCharts, ...chartBySlug.values()]
}

export function AllCharts(props: AllChartsProps) {
    const { heading, top, className, id = ALL_CHARTS_ID } = props
    const { relatedCharts, tags } = useContext(AttachmentsContext)
    if (relatedCharts.length === 0) return null

    const topSlugs = top.map((item) => Url.fromURL(item.url).slug as string)

    const firstTag = tags[0]
    const firstTagDataCatalogQueryString = firstTag
        ? queryParamsToStr({ topics: firstTag.name })
        : ""

    const sortedRelatedCharts = sortRelatedCharts(relatedCharts, topSlugs)
    return (
        <div className={cx(className)}>
            <h1 className="article-block__heading h1-semibold" id={id}>
                <span>
                    {firstTag ? `Key Charts on ${firstTag.name}` : heading}
                </span>
                <a className="deep-link" aria-labelledby={id} href={`#${id}`} />
            </h1>
            <Button
                theme="solid-vermillion"
                text="See all charts on this topic"
                href={`${urljoin(BAKED_BASE_URL, `/data`, firstTagDataCatalogQueryString)}`}
            />
            <RelatedCharts
                showKeyChartsOnly={true}
                charts={sortedRelatedCharts}
            />
        </div>
    )
}
