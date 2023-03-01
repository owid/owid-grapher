import React, { useContext } from "react"

import {
    getLinkType,
    getUrlTarget,
    Span,
    SpanLink,
    OwidArticleType,
    ImageMetadata,
} from "@ourworldindata/utils"
import { match, P } from "ts-pattern"
import { AttachmentsContext, SiteBakerContext } from "./OwidArticle.js"

export const useLinkedDocument = (url: string): OwidArticleType | undefined => {
    const { linkedDocuments } = useContext(AttachmentsContext)
    const { isBaking } = useContext(SiteBakerContext)
    const linkType = getLinkType(url)
    const urlTarget = getUrlTarget(url)

    if (linkType !== "gdoc") return
    const linkedDocument = linkedDocuments?.[urlTarget]
    if (linkedDocument && linkedDocument.published) {
        return linkedDocument
    } else if (isBaking) {
        throw new Error(
            "Error attempting to bake article linking to unpublished or non-existing article"
        )
    }
    return
}

export const useImage = (filename: string): ImageMetadata | undefined => {
    const { imageMetadata } = useContext(AttachmentsContext)
    const { isBaking } = useContext(SiteBakerContext)

    const metadata = imageMetadata[filename]
    if (metadata) {
        // TODO: handle defaultAlt errors etc
        return metadata
    } else if (isBaking) {
        // TODO: make this a slack error
        // But then it will log every time the component renders?
        throw new Error("Error baking an article with a missing image")
    }
    return
}

export function spansToUnformattedPlainText(spans: Span[] = []): string {
    return spans
        .map((span) =>
            match(span)
                .with({ spanType: "span-simple-text" }, (span) => span.text)
                .with(
                    {
                        spanType: P.union(
                            "span-link",
                            "span-italic",
                            "span-bold",
                            "span-fallback",
                            "span-quote",
                            "span-superscript",
                            "span-subscript",
                            "span-underline",
                            "span-ref"
                        ),
                    },
                    (span) => spansToUnformattedPlainText(span.children)
                )
                .with({ spanType: "span-newline" }, () => "")
                .exhaustive()
        )
        .join("")
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
