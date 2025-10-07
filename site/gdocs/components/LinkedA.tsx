import { useContext } from "react"
import { getLinkType } from "@ourworldindata/components"
import { SpanLink } from "@ourworldindata/types"
import { useLinkedDocument, useLinkedChart } from "../utils.js"
import { Url } from "@ourworldindata/utils"
import Tippy from "@tippyjs/react"
import SpanElements from "./SpanElements.js"
import { ChartPreview } from "./ChartPreview.js"
import { SiteAnalytics } from "../../SiteAnalytics.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons"
import { DocumentContext } from "../DocumentContext.js"

const analytics = new SiteAnalytics()

export default function LinkedA({ span }: { span: SpanLink }) {
    const linkType = getLinkType(span.url)
    const { archiveContext } = useContext(DocumentContext)
    const isOnArchivalPage = archiveContext?.type === "archive-page"
    const { linkedDocument } = useLinkedDocument(span.url)
    const { linkedChart } = useLinkedChart(span.url)

    if (linkType === "url") {
        return (
            <a href={span.url} className="span-link">
                <SpanElements spans={span.children} />
            </a>
        )
    }
    if (linkedChart) {
        const url = Url.fromURL(linkedChart.resolvedUrl)
        const chartSlug = url.slug || ""
        const queryString = url.queryStr

        const chartLink = (
            <a
                href={linkedChart.resolvedUrl}
                className="span-link span-linked-chart"
            >
                <SpanElements spans={span.children} />
                <FontAwesomeIcon
                    className="span-linked-chart-icon"
                    icon={faChartLine}
                />
            </a>
        )

        if (isOnArchivalPage) {
            return chartLink
        }

        return (
            <Tippy
                content={
                    <ChartPreview
                        chartType={url.isExplorer ? "explorer" : "chart"}
                        chartSlug={chartSlug}
                        queryString={queryString}
                    />
                }
                onShow={() =>
                    analytics.logChartPreviewMouseover(linkedChart.resolvedUrl)
                }
                delay={[300, 0]}
                placement="top"
                maxWidth={512}
                theme="light"
                arrow={false}
                touch={false}
            >
                {chartLink}
            </Tippy>
        )
    }
    if (linkedDocument && linkedDocument.published && linkedDocument.url) {
        return (
            <a href={linkedDocument.url} className="span-link">
                <SpanElements spans={span.children} />
            </a>
        )
    }
    return <SpanElements spans={span.children} />
}
