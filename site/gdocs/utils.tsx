import React, { useContext } from "react"

import {
    getLinkType,
    getUrlTarget,
    Span,
    SpanLink,
    OwidArticleType,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { LinkedDocumentsContext, SiteBakerContext } from "./OwidArticle.js"

const useLinkedDocument = (url: string): OwidArticleType | undefined => {
    const linkedDocuments = useContext(LinkedDocumentsContext)
    const isBaking = useContext(SiteBakerContext)
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
