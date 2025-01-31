import { useContext } from "react"
import urljoin from "url-join"
import cx from "classnames"
import {
    EnrichedBlockAllCharts,
    RelatedChart,
    Url,
    ALL_CHARTS_ID,
    KeyChartLevel,
} from "@ourworldindata/utils"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { RelatedCharts } from "../../blocks/RelatedCharts.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"

type AllChartsProps = EnrichedBlockAllCharts & {
    className?: string
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
    const { heading, top, className } = props
    const { relatedCharts, tags } = useContext(AttachmentsContext)
    const topSlugs = top.map((item) => Url.fromURL(item.url).slug as string)

    const firstTag = tags[0]
    const firstTagDataCatalogQueryString = firstTag
        ? `?topics=${firstTag.name}`
        : ""

    const sortedRelatedCharts = sortRelatedCharts(relatedCharts, topSlugs)
    return (
        <div className={cx(className)}>
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
            <a
                className="owid-button"
                href={`${urljoin(BAKED_BASE_URL, `/data`, firstTagDataCatalogQueryString)}`}
            >
                <span className="body-3-medium">
                    See all charts on this topic
                    <FontAwesomeIcon icon={faArrowRight} />
                </span>
            </a>
            <RelatedCharts
                showKeyChartsOnly={true}
                charts={sortedRelatedCharts}
            />
        </div>
    )
}
