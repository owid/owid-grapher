import React from "react"
import {
    EnrichedBlockNumberedList,
    EnrichedBlockText,
} from "@ourworldindata/utils"
import { renderSpans } from "../utils.js"
export default function NumberedList({
    d,
    className = "",
}: {
    d: EnrichedBlockNumberedList
    className?: string
}) {
    return (
        <ol className={className}>
            {d.items.map((_d: EnrichedBlockText, i: number) => {
                return <li key={i}>{renderSpans(_d.value)}</li>
            })}
        </ol>
    )
}
