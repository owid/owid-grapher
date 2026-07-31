import { getLinkType } from "@ourworldindata/components"
import { OwidGdocMinimalPostInterface, SpanLink } from "@ourworldindata/types"
import {
    useLinkedDocument,
    useLinkedDocumentByPath,
    useLinkedChart,
} from "../utils.js"
import { Url } from "@ourworldindata/utils"
import Tippy from "@tippyjs/react"
import SpanElements from "./SpanElements.js"
import { ChartPreview } from "./ChartPreview.js"
import { DocumentPreview } from "./DocumentPreview.js"
import { SiteAnalytics } from "../../SiteAnalytics.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons"
import { useDocumentContext } from "../DocumentContext.js"

const analytics = new SiteAnalytics()

/**
 * Whether there's enough material to make a hover preview card worth showing.
 * A card with nothing but a title that repeats the link text is worse than no
 * card at all — the common case for data insights.
 */
function hasDocumentPreviewContent(
    linkedDocument: OwidGdocMinimalPostInterface
): boolean {
    return Boolean(
        linkedDocument.excerpt ||
        linkedDocument.subtitle ||
        linkedDocument["featured-image"]
    )
}

/** Wraps a link in the hover card for the document it points at. */
function DocumentPreviewTooltip({
    linkedDocument,
    documentUrl,
    children,
}: {
    linkedDocument: OwidGdocMinimalPostInterface
    documentUrl: string
    children: React.ReactElement
}) {
    return (
        <Tippy
            content={<DocumentPreview linkedDocument={linkedDocument} />}
            onShow={() => analytics.logDocumentPreviewMouseover(documentUrl)}
            appendTo={() => document.body}
            delay={[300, 0]}
            placement="top"
            maxWidth={400}
            theme="light"
            arrow={false}
            touch={false}
        >
            {children}
        </Tippy>
    )
}

export default function LinkedA({ span }: { span: SpanLink }) {
    const linkType = getLinkType(span.url)
    const { archiveContext, isPreviewing } = useDocumentContext()
    const isOnArchivalPage = archiveContext?.type === "archive-page"
    const { linkedDocument, errorMessage } = useLinkedDocument(span.url)
    const { linkedChart } = useLinkedChart(span.url)
    const documentAtUrl = useLinkedDocumentByPath(span.url)

    if (linkType === "url") {
        const urlLink = (
            <a href={span.url} className="span-link">
                <SpanElements spans={span.children} />
            </a>
        )

        // Most links to our own articles are authored as a plain
        // ourworldindata.org URL rather than a gdoc URL. Those still deserve a
        // hover card whenever the article they point at is attached to the
        // page. The href stays exactly as authored — only the card is added.
        if (
            isOnArchivalPage ||
            !documentAtUrl ||
            !hasDocumentPreviewContent(documentAtUrl)
        ) {
            return urlLink
        }

        return (
            <DocumentPreviewTooltip
                linkedDocument={documentAtUrl}
                documentUrl={span.url}
            >
                {urlLink}
            </DocumentPreviewTooltip>
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
        const documentLink = (
            <a href={linkedDocument.url} className="span-link">
                <SpanElements spans={span.children} />
            </a>
        )

        // Cloudflare Images URLs aren't archived, so the thumbnail would break.
        if (isOnArchivalPage) {
            return documentLink
        }

        if (!hasDocumentPreviewContent(linkedDocument)) {
            return documentLink
        }

        return (
            <DocumentPreviewTooltip
                linkedDocument={linkedDocument}
                documentUrl={linkedDocument.url}
            >
                {documentLink}
            </DocumentPreviewTooltip>
        )
    }
    if (errorMessage && isPreviewing) {
        return (
            <span className="span-link--error" title={errorMessage}>
                <SpanElements spans={span.children} />
            </span>
        )
    }
    return <SpanElements spans={span.children} />
}
