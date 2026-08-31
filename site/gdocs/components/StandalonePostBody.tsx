import * as React from "react"
import cx from "clsx"
import { OwidEnrichedGdocBlock } from "@ourworldindata/types"
import { ArticleBlocks } from "./ArticleBlocks.js"
import LinkedAuthor from "./LinkedAuthor.js"
import DataInsightDateline from "./DataInsightDateline.js"

/** Grid placement of the narrow single column a standalone page is laid out
 * in — the body card and the breadcrumb above it. */
export const STANDALONE_POST_GRID_CLASSES =
    "span-cols-6 col-start-5 span-md-cols-8 col-md-start-4 col-sm-start-1 span-sm-cols-14"

/**
 * The white card a short standalone page is made of: dateline, title, author
 * byline, body, and a footer the page supplies (related topics, copy buttons).
 * Shared by data insight and announcement pages so the two can't drift apart.
 *
 * Blocks render with the "data-insight" container type, which means "single
 * column, no grid sizing" — the card is one narrow column on every page that
 * uses this.
 */
export default function StandalonePostBody({
    className,
    title,
    authors,
    body,
    publishedAt,
    datelineFormatOptions = {
        year: "numeric",
        month: "long",
        day: "2-digit",
    },
    footer,
}: {
    className?: string
    title: string
    authors: string[]
    body: OwidEnrichedGdocBlock[]
    publishedAt: Date | string | null
    datelineFormatOptions?: Intl.DateTimeFormatOptions
    footer?: React.ReactNode
}) {
    return (
        <div
            className={cx(
                "grid grid-cols-1",
                STANDALONE_POST_GRID_CLASSES,
                className
            )}
        >
            <div className="standalone-post-body">
                <DataInsightDateline
                    className="standalone-post-body__dateline"
                    publishedAt={publishedAt ? new Date(publishedAt) : null}
                    formatOptions={datelineFormatOptions}
                />
                <h1 className="display-3-semibold">{title}</h1>
                <div className="standalone-post-body__authors body-3-medium">
                    {authors.map((author, index) => (
                        <LinkedAuthor
                            className="standalone-post-body__author"
                            key={index}
                            name={author}
                            includeImage={true}
                        />
                    ))}
                </div>
                <div className="standalone-post-body__blocks">
                    <ArticleBlocks blocks={body} containerType="data-insight" />
                </div>
                {footer && (
                    <div className="standalone-post-body__footer">{footer}</div>
                )}
            </div>
        </div>
    )
}
