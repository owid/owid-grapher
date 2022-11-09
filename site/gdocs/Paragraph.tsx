import { EnrichedBlockText, Span } from "@ourworldindata/utils/dist/index.js"
import React from "react"
import { renderSpans } from "./utils"

function isOnlyEmptySpans(spans: Span[]) {
    return spans.every(
        (span) =>
            (span.spanType === ("span-simple-text" || "span-fallback") &&
                !span.text) ||
            span.spanType === "span-newline"
    )
}

export default function Paragraph({ d }: { d: EnrichedBlockText }) {
    if (isOnlyEmptySpans(d.value)) {
        return null
    }
    return (
        <div>
            <p>{renderSpans(d.value)}</p>
        </div>
    )
}
