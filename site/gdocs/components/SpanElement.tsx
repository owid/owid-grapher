import { Span } from "@ourworldindata/types"
import * as React from "react"
import { match } from "ts-pattern"
import LinkedA from "./LinkedA.js"
import SpanElements from "./SpanElements.js"
import { useGuidedChartLinkHandler } from "@ourworldindata/grapher"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faEye } from "@fortawesome/free-solid-svg-icons"
import { spansToUnformattedPlainText } from "@ourworldindata/utils"

export default function SpanElement({
    span,
    shouldRenderLinks = true,
}: {
    span: Span
    shouldRenderLinks?: boolean
}): React.ReactElement {
    const handleGuidedChartLinkClick = useGuidedChartLinkHandler()
    const [hasHydrated, setHasHydrated] = React.useState(false)
    React.useEffect(() => {
        setHasHydrated(true)
    }, [])

    return match(span)
        .with({ spanType: "span-simple-text" }, (span) => (
            <span>{span.text}</span>
        ))
        .with({ spanType: "span-link" }, (span) =>
            shouldRenderLinks ? (
                <LinkedA span={span} />
            ) : (
                <span>
                    <SpanElements
                        spans={span.children}
                        shouldRenderLinks={shouldRenderLinks}
                    />
                </span>
            )
        )
        .with({ spanType: "span-ref" }, (span) =>
            shouldRenderLinks ? (
                <a href={span.url} className="ref">
                    <SpanElements
                        spans={span.children}
                        shouldRenderLinks={shouldRenderLinks}
                    />
                </a>
            ) : (
                <span className="ref">
                    <SpanElements
                        spans={span.children}
                        shouldRenderLinks={shouldRenderLinks}
                    />
                </span>
            )
        )
        .with({ spanType: "span-guided-chart-link" }, (span) => {
            if (!shouldRenderLinks) {
                return (
                    <span className="guided-chart-link">
                        <SpanElements
                            spans={span.children}
                            shouldRenderLinks={shouldRenderLinks}
                        />
                    </span>
                )
            }

            const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault()
                if (handleGuidedChartLinkClick) {
                    handleGuidedChartLinkClick(span.url)
                }
            }

            return (
                <a
                    className="guided-chart-link"
                    href={span.url}
                    aria-label={
                        hasHydrated
                            ? `"${spansToUnformattedPlainText(span.children)}". Click to set this section's chart to this view.`
                            : undefined
                    }
                    onClick={handleClick}
                >
                    <FontAwesomeIcon icon={faEye} />
                    <SpanElements
                        spans={span.children}
                        shouldRenderLinks={shouldRenderLinks}
                    />
                </a>
            )
        })
        .with({ spanType: "span-dod" }, (span) => (
            <span className="dod-span" data-id={`${span.id}`} tabIndex={0}>
                <SpanElements
                    spans={span.children}
                    shouldRenderLinks={shouldRenderLinks}
                />
            </span>
        ))
        .with({ spanType: "span-newline" }, () => <br />)
        .with({ spanType: "span-italic" }, (span) => (
            <em>
                <SpanElements
                    spans={span.children}
                    shouldRenderLinks={shouldRenderLinks}
                />
            </em>
        ))
        .with({ spanType: "span-bold" }, (span) => (
            <strong>
                <SpanElements
                    spans={span.children}
                    shouldRenderLinks={shouldRenderLinks}
                />
            </strong>
        ))
        .with({ spanType: "span-underline" }, (span) => (
            <u>
                <SpanElements
                    spans={span.children}
                    shouldRenderLinks={shouldRenderLinks}
                />
            </u>
        ))
        .with({ spanType: "span-subscript" }, (span) => (
            <sub>
                <SpanElements
                    spans={span.children}
                    shouldRenderLinks={shouldRenderLinks}
                />
            </sub>
        ))
        .with({ spanType: "span-superscript" }, (span) => (
            <sup>
                <SpanElements
                    spans={span.children}
                    shouldRenderLinks={shouldRenderLinks}
                />
            </sup>
        ))
        .with({ spanType: "span-quote" }, (span) => (
            <q>
                <SpanElements
                    spans={span.children}
                    shouldRenderLinks={shouldRenderLinks}
                />
            </q>
        ))
        .with({ spanType: "span-fallback" }, (span) => (
            <span>
                <SpanElements
                    spans={span.children}
                    shouldRenderLinks={shouldRenderLinks}
                />
            </span>
        ))
        .exhaustive()
}
