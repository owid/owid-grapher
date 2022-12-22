import { EnrichedBlockText, Span } from "@ourworldindata/utils"
import React from "react"
import { renderSpans } from "./utils.js"

function isOnlyEmptySpans(spans: Span[]) {
    return spans.every((span) => {
        const isNewline = span.spanType === "span-newline"
        const isSimpleText = span.spanType === "span-simple-text"
        const isEmptySimpleText = isSimpleText && span.text === ""
        return isNewline || isEmptySimpleText
    })
}

export default function Paragraph({
    d,
    className = "",
}: {
    d: EnrichedBlockText
    className?: string
}) {
    if (isOnlyEmptySpans(d.value)) {
        return null
    }
    return <p className={className}>{renderSpans(d.value)}</p>
}
