import { EnrichedBlockText, Span } from "@ourworldindata/utils"
import { renderSpans } from "../utils.js"

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
    shouldRenderLinks = true,
}: {
    d: EnrichedBlockText
    className?: string
    shouldRenderLinks?: boolean
}) {
    if (isOnlyEmptySpans(d.value)) {
        return null
    }
    return (
        <p className={className}>{renderSpans(d.value, shouldRenderLinks)}</p>
    )
}
