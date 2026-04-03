import { EnrichedBlockPullChart } from "@ourworldindata/types"
import cx from "classnames"
import ChartThumbnail from "./ChartThumbnail.js"
import Paragraph from "./Paragraph.js"

export default function PullChart({
    d,
    className = "",
}: {
    d: EnrichedBlockPullChart
    className?: string
}) {
    const alignClass = `pull-chart--align-${d.align ?? "left-center"}`

    return (
        <div className={cx("pull-chart", alignClass, className)}>
            <a href={d.url} className="chart-thumbnail">
                <ChartThumbnail image={d.image} containerType="pull-chart" />
            </a>
            {d.content.map((block, i) => (
                <Paragraph key={i} d={block} className="article-block__text" />
            ))}
        </div>
    )
}
