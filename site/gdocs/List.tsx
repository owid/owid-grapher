import React from "react"
import { EnrichedBlockList, EnrichedBlockText } from "@ourworldindata/utils"
import { renderSpans } from "./utils"
export default function List({ d }: { d: EnrichedBlockList }) {
    return (
        <ul className={"list"}>
            {d.items.map((_d: EnrichedBlockText, i: number) => {
                return <li key={i}>{renderSpans(_d.value)}</li>
            })}
        </ul>
    )
}
