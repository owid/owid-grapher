import React from "react"
import { EnrichedBlockList, EnrichedBlockText } from "@ourworldindata/utils"
import { renderSpans } from "./utils.js"
export default function List({
    d,
    className = "",
}: {
    d: EnrichedBlockList
    className?: string
}) {
    return (
        <ul className={className}>
            {d.items.map((_d: EnrichedBlockText, i: number) => {
                return <li key={i}>{renderSpans(_d.value)}</li>
            })}
        </ul>
    )
}
