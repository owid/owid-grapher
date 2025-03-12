import { Span } from "@ourworldindata/types"
import SpanElement from "./SpanElement.js"
import { useEffect, useState } from "react"

export default function SpanElements({
    spans,
    shouldRenderLinks = true,
}: {
    spans: Span[]
    shouldRenderLinks?: boolean
}) {
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    if (isClient) {
        throw new Error("Test error boundary")
    }

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
