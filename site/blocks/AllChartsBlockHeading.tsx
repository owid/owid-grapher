import * as React from "react"
import { commafyNumber } from "@ourworldindata/utils"

export function AllChartsBlockHeading({
    id,
    heading,
    hitCount,
}: {
    id: string
    heading: string
    hitCount?: number
}): React.ReactElement {
    return (
        <h1
            className="article-block__heading h1-semibold all-charts-block-heading"
            id={id}
        >
            <span>{heading}</span>
            {hitCount !== undefined && (
                <span className="all-charts-block-heading__count">
                    {`(${commafyNumber(hitCount)} ${hitCount === 1 ? "chart" : "charts"})`}
                </span>
            )}
            <a className="deep-link" aria-labelledby={id} href={`#${id}`} />
        </h1>
    )
}
