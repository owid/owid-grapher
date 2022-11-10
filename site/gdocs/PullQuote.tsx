import React from "react"
import { EnrichedBlockPullQuote } from "@ourworldindata/utils"
import { renderSpans } from "./utils"
export default function PullQuote({ d }: { d: EnrichedBlockPullQuote }) {
    return (
        <blockquote className={"pullQuote"}>
            {d.text.map((d) => d.text).join("\n")}
        </blockquote>
    )
}
