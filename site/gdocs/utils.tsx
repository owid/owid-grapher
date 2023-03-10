import React, { useContext } from "react"

import {
    getLinkType,
    getUrlTarget,
    Span,
    SpanLink,
    OwidArticleType,
    ImageMetadata,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { AttachmentsContext } from "./OwidArticle.js"

export const useLinkedDocument = (url: string): OwidArticleType | undefined => {
    const { linkedDocuments } = useContext(AttachmentsContext)
    const urlTarget = getUrlTarget(url)
    const linkedDocument = linkedDocuments?.[urlTarget]
    return linkedDocument
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
    const linkedDocument = useLinkedDocument(span.url)

    if (linkType === "url") {
        return (
            <a href={span.url} className="span-link">
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
