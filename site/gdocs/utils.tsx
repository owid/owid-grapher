import React from "react"

import {
    getLinkType,
    getUrlTarget,
    Span,
    SpanLink,
} from "@ourworldindata/utils"
import { match } from "ts-pattern"
import { LinkedDocumentsContext } from "./OwidArticle.js"

const LinkedA = ({ span }: { span: SpanLink }): JSX.Element => {
    const linkType = getLinkType(span.url)
    if (linkType === "url") {
        return (
            <a href={span.url} className="span-link">
                {renderSpans(span.children)}
            </a>
        )
    }
    return (
        <LinkedDocumentsContext.Consumer>
            {(linkedDocuments) => {
                const urlTarget = getUrlTarget(span.url)
                const targetDocument = linkedDocuments[urlTarget]
                if (
                    targetDocument &&
                    targetDocument.published &&
                    targetDocument.slug
                ) {
                    return (
                        <a
                            href={`/${targetDocument.slug}`}
                            className="span-link"
                        >
                            {renderSpans(span.children)}
                        </a>
                    )
                }
                // TODO: log error to slack if baking
                return renderSpans(span.children)
            }}
        </LinkedDocumentsContext.Consumer>
    )
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
