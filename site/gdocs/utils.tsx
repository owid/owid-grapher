import React from "react"

import { Span } from "@ourworldindata/utils"
import { match, P } from "ts-pattern"

export function spansToUnformattedPlainText(spans: Span[]): string {
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

export function renderSpan(
    span: Span,
    key: React.Key | null | undefined = undefined
): JSX.Element {
    return match(span)
        .with({ spanType: "span-simple-text" }, (span) => (
            <React.Fragment key={key}>{span.text}</React.Fragment>
        ))
        .with({ spanType: "span-link" }, (span) => (
            <a key={key} href={span.url} className="span-link">
                {renderSpans(span.children)}
            </a>
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
