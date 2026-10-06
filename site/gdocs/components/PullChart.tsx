import { useId } from "react"
import { EnrichedBlockPullChart } from "@ourworldindata/types"
import cx from "clsx"
import ChartThumbnail from "./ChartThumbnail.js"
import Paragraph from "./Paragraph.js"

export default function PullChart({
    d,
    className = "",
    shouldRenderLinks = true,
}: {
    d: EnrichedBlockPullChart
    className?: string
    shouldRenderLinks?: boolean
}) {
    const contentId = useId()
    const alignClass = `pull-chart--align-${d.align ?? "left-center"}`
    const hasContent = d.content.length > 0

    return (
        <div className={cx("pull-chart", alignClass, className)}>
            {shouldRenderLinks ? (
                <a
                    href={d.url}
                    className="chart-thumbnail pull-chart__thumbnail"
                    aria-label="See chart"
                    aria-describedby={hasContent ? contentId : undefined}
                >
                    <ChartThumbnail
                        image={d.image}
                        containerType="pull-chart"
                    />
                </a>
            ) : (
                <div className="chart-thumbnail chart-thumbnail--static pull-chart__thumbnail">
                    <ChartThumbnail
                        image={d.image}
                        containerType="pull-chart"
                    />
                </div>
            )}
            {hasContent && (
                <div className="pull-chart__content" id={contentId}>
                    {d.content.map((block, i) => (
                        <Paragraph
                            key={i}
                            d={block}
                            className="article-block__text"
                            shouldRenderLinks={shouldRenderLinks}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
