import { Span } from "@ourworldindata/types"
import SpanElement from "./SpanElement.js"

export default function SpanElements({
    spans,
    shouldRenderLinks = true,
}: {
    spans: Span[]
    shouldRenderLinks?: boolean
}) {
    return (
        <>
            {spans.map((span, index) => (
                <SpanElement
                    key={index}
                    span={span}
                    shouldRenderLinks={shouldRenderLinks}
                />
            ))}
        </>
    )
}
