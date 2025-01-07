import { Span } from "@ourworldindata/types"
import * as React from "react"
import { match } from "ts-pattern"
import LinkedA from "./LinkedA.js"
import SpanElements from "./SpanElements.js"

export default function SpanElement({
    span,
    shouldRenderLinks = true,
}: {
    span: Span
    shouldRenderLinks?: boolean
}): React.ReactElement {
    return match(span)
        .with({ spanType: "span-simple-text" }, (span) => (
            <span>{span.text}</span>
        ))
        .with({ spanType: "span-link" }, (span) =>
            shouldRenderLinks ? (
                <LinkedA span={span} />
            ) : (
                <span>
                    <SpanElements spans={span.children} />
                </span>
            )
        )
        .with({ spanType: "span-ref" }, (span) =>
            shouldRenderLinks ? (
                <a href={span.url} className="ref">
                    <SpanElements spans={span.children} />
                </a>
            ) : (
                <span className="ref">
                    <SpanElements spans={span.children} />
                </span>
            )
        )
        .with({ spanType: "span-dod" }, (span) => (
            <span className="dod-span" data-id={`${span.id}`} tabIndex={0}>
                <SpanElements spans={span.children} />
            </span>
        ))
        .with({ spanType: "span-newline" }, () => <br />)
        .with({ spanType: "span-italic" }, (span) => (
            <em>
                <SpanElements spans={span.children} />
            </em>
        ))
        .with({ spanType: "span-bold" }, (span) => (
            <strong>
                <SpanElements spans={span.children} />
            </strong>
        ))
        .with({ spanType: "span-underline" }, (span) => (
            <u>
                <SpanElements spans={span.children} />
            </u>
        ))
        .with({ spanType: "span-subscript" }, (span) => (
            <sub>
                <SpanElements spans={span.children} />
            </sub>
        ))
        .with({ spanType: "span-superscript" }, (span) => (
            <sup>
                <SpanElements spans={span.children} />
            </sup>
        ))
        .with({ spanType: "span-quote" }, (span) => (
            <q>
                <SpanElements spans={span.children} />
            </q>
        ))
        .with({ spanType: "span-fallback" }, (span) => (
            <span>
                <SpanElements spans={span.children} />
            </span>
        ))
        .exhaustive()
}
