import React, { useContext } from "react"

import {
    getLinkType,
    getUrlTarget,
    Span,
    SpanLink,
    OwidGdocInterface,
    ImageMetadata,
    LinkedChart,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { AttachmentsContext } from "./OwidGdoc.js"

export const useLinkedDocument = (
    url: string
): { linkedDocument?: OwidGdocInterface; errorMessage?: string } => {
    let errorMessage: string | undefined = undefined
    const { linkedDocuments } = useContext(AttachmentsContext)
    const urlTarget = getUrlTarget(url)
    const linkType = getLinkType(url)
    const linkedDocument = linkedDocuments?.[urlTarget]
    if (linkType === "gdoc") {
        if (!linkedDocument) {
            errorMessage = `Google doc URL ${url} isn't registered.`
        } else if (!linkedDocument.published) {
            errorMessage = `Article with slug "${linkedDocument.slug}" isn't published.`
        }
    }
    return { linkedDocument, errorMessage }
}

export const useLinkedChart = (
    url: string
): { linkedChart?: LinkedChart; errorMessage?: string } => {
    let errorMessage: string | undefined = undefined
    const { linkedCharts } = useContext(AttachmentsContext)
    const urlTarget = getUrlTarget(url)
    const linkType = getLinkType(url)
    const linkedChart = linkedCharts?.[urlTarget]
    if (linkType === "grapher" || linkType === "explorer") {
        if (!linkedChart) {
            errorMessage = `${linkType} chart with slug ${urlTarget} not found`
        }
    }
    return { linkedChart, errorMessage }
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
        return (
            <a
                href={span.url}
                target="_blank"
                rel="noopener noreferrer"
                className="span-link"
            >
                {renderSpans(span.children)}
            </a>
        )
    }
    if (linkedChart) {
        return (
            <a href={`/${linkedChart.slug}`} className="span-link">
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
