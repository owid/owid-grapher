import React from "react"

import { Span } from "@ourworldindata/utils"
import { match } from "ts-pattern"

export function renderSpans(spans: Span[]): JSX.Element[] {
    return spans.map((span, i) =>
        match(span)
            .with({ spanType: "span-simple-text" }, (span) => (
                <React.Fragment key={i}>{span.text}</React.Fragment>
            ))
            .with({ spanType: "span-link" }, (span) => (
                <a key={i} href={span.url}>
                    {renderSpans(span.children)}
                </a>
            ))
            .with({ spanType: "span-newline" }, () => <br key={i} />)
            .with({ spanType: "span-italic" }, (span) => (
                <em key={i}>{renderSpans(span.children)}</em>
            ))
            .with({ spanType: "span-bold" }, (span) => (
                <strong key={i}>{renderSpans(span.children)}</strong>
            ))
            .with({ spanType: "span-underline" }, (span) => (
                <u key={i}>{renderSpans(span.children)}</u>
            ))
            .with({ spanType: "span-subscript" }, (span) => (
                <sub key={i}>{renderSpans(span.children)}</sub>
            ))
            .with({ spanType: "span-superscript" }, (span) => (
                <sup key={i}>{renderSpans(span.children)}</sup>
            ))
            .with({ spanType: "span-quote" }, (span) => (
                <q key={i}>{renderSpans(span.children)}</q>
            ))
            .with({ spanType: "span-fallback" }, (span) => (
                <React.Fragment key={i}>
                    {renderSpans(span.children)}
                </React.Fragment>
            ))
            .exhaustive()
    )
}
