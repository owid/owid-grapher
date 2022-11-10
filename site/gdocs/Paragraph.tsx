import {
    EnrichedBlockText,
    Span,
    SpanSimpleText,
} from "@ourworldindata/utils/dist/index.js"
import React from "react"
import { renderSpans } from "./utils"

function isOnlyEmptySpans(spans: Span[]) {
    return spans.every((span) => {
        const isNewline = span.spanType === "span-newline"
        const isSimpleText = "span-simple-text"
        const isNonEmptySimpleTextOrFallback =
            isSimpleText && (span as SpanSimpleText).text !== ""
        return isNewline || isNonEmptySimpleTextOrFallback
    })
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
