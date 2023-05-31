import React from "react"
import cx from "classnames"
import { EnrichedBlockAllCharts } from "@ourworldindata/utils"

type AllChartsProps = EnrichedBlockAllCharts & {
    className?: string
}

export function AllCharts(props: AllChartsProps) {
    const { category, top, className } = props

    return (
        <div className={cx(className)}>
            <p>{category}</p>
            {top.map((item) => (
                <p key={item.url}>{item.url}</p>
            ))}
        </div>
    )
}
