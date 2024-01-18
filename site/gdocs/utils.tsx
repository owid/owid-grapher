import React, { useContext } from "react"

import { getLinkType, getUrlTarget } from "@ourworldindata/components"
import {
    Span,
    SpanLink,
    ImageMetadata,
    LinkedChart,
    Url,
    OwidGdocPostContent,
    formatAuthors,
    OwidGdocMinimalPostInterface,
    OwidGdocType,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { AttachmentsContext } from "./OwidGdoc.js"

export const breadcrumbColorForCoverColor = (
    coverColor: OwidGdocPostContent["cover-color"]
): "white" | "blue" => {
    // exhaustive list of all possible cover colors
    switch (coverColor) {
        case "sdg-color-1": // red
        case "sdg-color-3": // green
        case "sdg-color-4": // red
        case "sdg-color-5": // orange-red
        case "sdg-color-8": // dark red
        case "sdg-color-10": // purple
        case "sdg-color-13": // dark green
        case "sdg-color-14": // blue
        case "sdg-color-16": // blue
        case "sdg-color-17": // dark blue
            return "white"
        case "sdg-color-2": // orange
        case "sdg-color-6": // light blue
        case "sdg-color-7": // yellow
        case "sdg-color-9": // orange
        case "sdg-color-11": // yellow orange
        case "sdg-color-12": // yellow-brown
        case "sdg-color-15": // light green
        case "amber": // amber
        case undefined: // default cover color: blue-10
            return "blue"
    }
}

export const useLinkedDocument = (
    url: string
): { linkedDocument?: OwidGdocMinimalPostInterface; errorMessage?: string } => {
    const { linkedDocuments } = useContext(AttachmentsContext)
    let errorMessage: string | undefined = undefined
    let linkedDocument: OwidGdocMinimalPostInterface | undefined = undefined
    const linkType = getLinkType(url)
    if (linkType !== "gdoc") {
        return { linkedDocument }
    }

    const urlObj = Url.fromURL(url)
    const queryString = urlObj.queryStr
    const hash = urlObj.hash
    const urlTarget = getUrlTarget(url)
    linkedDocument = linkedDocuments?.[urlTarget] as
        | OwidGdocMinimalPostInterface
        | undefined

    if (!linkedDocument) {
        errorMessage = `Google doc URL ${url} isn't registered.`
        return { errorMessage }
    } else if (!linkedDocument.published) {
        errorMessage = `Article with slug "${linkedDocument.slug}" isn't published.`
    }
    const subdirectory =
        linkedDocument.type === OwidGdocType.DataInsight ? "data-insights/" : ""
    return {
        linkedDocument: {
            ...linkedDocument,
            slug: `${subdirectory}${linkedDocument.slug}${queryString}${hash}`,
        },
        errorMessage,
    }
}

export const useLinkedChart = (
    url: string
): { linkedChart?: LinkedChart; errorMessage?: string } => {
    const { linkedCharts } = useContext(AttachmentsContext)
    const linkType = getLinkType(url)
    if (linkType !== "grapher" && linkType !== "explorer") return {}

    const queryString = Url.fromURL(url).queryStr
    const urlTarget = getUrlTarget(url)
    const linkedChart = linkedCharts?.[urlTarget]
    if (!linkedChart) {
        return {
            errorMessage: `${linkType} chart with slug ${urlTarget} not found`,
        }
    }

    return {
        linkedChart: {
            ...linkedChart,
            // linkedCharts doesn't store any querystring information, because it's indexed by slug
            // Instead we get the querystring from the original URL and append it to resolvedUrl
            resolvedUrl: `${linkedChart.resolvedUrl}${queryString}`,
        },
    }
}

export const useImage = (
    filename: string | undefined
): ImageMetadata | undefined => {
    const { imageMetadata } = useContext(AttachmentsContext)
    if (!filename) return
    const metadata = imageMetadata[filename]
    return metadata
}

const LinkedA = ({ span }: { span: SpanLink }): JSX.Element => {
    const linkType = getLinkType(span.url)
    const { linkedDocument } = useLinkedDocument(span.url)
    const { linkedChart } = useLinkedChart(span.url)

    if (linkType === "url") {
        // Don't open in new tab if it's an anchor link
        const linkProps = !span.url.startsWith("#")
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {}
        return (
            <a href={span.url} className="span-link" {...linkProps}>
                {renderSpans(span.children)}
            </a>
        )
    }
    if (linkedChart) {
        return (
            <a href={linkedChart.resolvedUrl} className="span-link">
                {renderSpans(span.children)}
            </a>
        )
    }
    if (linkedDocument && linkedDocument.published && linkedDocument.slug) {
        return (
            <a href={`/${linkedDocument.slug}`} className="span-link">
                {renderSpans(span.children)}
            </a>
        )
    }
    return <>{renderSpans(span.children)}</>
}

export function renderSpan(
    span: Span,
    key: React.Key | null | undefined = undefined
): JSX.Element {
    return match(span)
        .with({ spanType: "span-simple-text" }, (span) => (
            <React.Fragment key={key}>{span.text}</React.Fragment>
        ))
        .with({ spanType: "span-link" }, (span) => (
            <LinkedA span={span} key={key} />
        ))
        .with({ spanType: "span-ref" }, (span) => (
            <a key={key} href={span.url} className="ref">
                {renderSpans(span.children)}
            </a>
        ))
        .with({ spanType: "span-dod" }, (span) => (
            <span key={key}>
                <a data-id={`${span.id}`} className="dod-span">
                    {renderSpans(span.children)}
                </a>
            </span>
        ))
        .with({ spanType: "span-newline" }, () => <br key={key} />)
        .with({ spanType: "span-italic" }, (span) => (
            <em key={key}>{renderSpans(span.children)}</em>
        ))
        .with({ spanType: "span-bold" }, (span) => (
            <strong key={key}>{renderSpans(span.children)}</strong>
        ))
        .with({ spanType: "span-underline" }, (span) => (
            <u key={key}>{renderSpans(span.children)}</u>
        ))
        .with({ spanType: "span-subscript" }, (span) => (
            <sub key={key}>{renderSpans(span.children)}</sub>
        ))
        .with({ spanType: "span-superscript" }, (span) => (
            <sup key={key}>{renderSpans(span.children)}</sup>
        ))
        .with({ spanType: "span-quote" }, (span) => (
            <q key={key}>{renderSpans(span.children)}</q>
        ))
        .with({ spanType: "span-fallback" }, (span) => (
            <React.Fragment key={key}>
                {renderSpans(span.children)}
            </React.Fragment>
        ))
        .exhaustive()
}

export function renderSpans(spans: Span[]): JSX.Element[] {
    return spans.map(renderSpan)
}

export function getShortPageCitation(
    authors: string[],
    title: string,
    publishedAt: Date | null
) {
    return `${formatAuthors({
        authors: authors,
    })} (${publishedAt?.getFullYear()}) - “${title}”`
}
