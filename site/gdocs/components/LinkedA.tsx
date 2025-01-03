import { getLinkType } from "@ourworldindata/components"
import { SpanLink } from "@ourworldindata/types"
import { useLinkedDocument, useLinkedChart } from "../utils.js"
import SpanElements from "./SpanElements.js"

export default function LinkedA({ span }: { span: SpanLink }) {
    const linkType = getLinkType(span.url)
    const { linkedDocument } = useLinkedDocument(span.url)
    const { linkedChart } = useLinkedChart(span.url)

    if (linkType === "url") {
        // Don't open in new tab if it's an anchor link
        const linkProps = !span.url.startsWith("#")
            ? { target: "_blank", rel: "noopener" }
            : {}
        return (
            <a href={span.url} className="span-link" {...linkProps}>
                <SpanElements spans={span.children} />
            </a>
        )
    }
    if (linkedChart) {
        return (
            <a href={linkedChart.resolvedUrl} className="span-link">
                <SpanElements spans={span.children} />
            </a>
        )
    }
    if (linkedDocument && linkedDocument.published && linkedDocument.slug) {
        return (
            <a href={`/${linkedDocument.slug}`} className="span-link">
                <SpanElements spans={span.children} />
            </a>
        )
    }
    return <SpanElements spans={span.children} />
}
