import React from "react"
import cx from "classnames"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { DisplaySource, dayjs, uniqBy } from "@ourworldindata/utils"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"
import { CodeSnippet } from "../CodeSnippet/CodeSnippet.js"
import { REUSE_THIS_WORK_SECTION_ID } from "../SharedDataPageConstants.js"

export interface IndicatorSourcesProps {
    sources: DisplaySource[]
    isEmbeddedInADataPage?: boolean // true by default
}

export const IndicatorSources = (props: IndicatorSourcesProps) => {
    const isEmbeddedInADataPage = props.isEmbeddedInADataPage ?? true
    const uniqueSources = uniqBy(props.sources, "label")

    return (
        <div className="indicator-sources">
            {uniqueSources.map((source: DisplaySource, idx: number) => {
                const isStacked = idx !== uniqueSources.length - 1
                const content = (
                    <SourceContent
                        source={source}
                        isEmbeddedInADataPage={isEmbeddedInADataPage}
                    />
                )
                return source.description ||
                    source.citation ||
                    source.dataPublishedBy ? (
                    <ExpandableToggle
                        key={source.label}
                        label={source.label}
                        content={content}
                        isStacked={isStacked}
                        hasTeaser
                    />
                ) : (
                    <NonExpandable
                        key={source.label}
                        label={source.label}
                        isStacked={isStacked}
                        content={content}
                    />
                )
            })}
        </div>
    )
}

const NonExpandable = (props: {
    label: string
    content: React.ReactNode
    isStacked?: boolean
}) => {
    return (
        <div
            className={cx("NonExpandable", {
                "NonExpandable--stacked": props.isStacked,
            })}
        >
            <h4 className="NonExpandable__title">{props.label}</h4>
            <div className="NonExpandable__content">{props.content}</div>
        </div>
    )
}

const SourceContent = (props: {
    source: DisplaySource
    isEmbeddedInADataPage: boolean
}) => {
    const { source } = props
    const retrievedOn = source.retrievedOn
        ? dayjs(source.retrievedOn).format("MMMM D, YYYY")
        : undefined
    const showKeyInfo =
        source.dataPublishedBy ||
        retrievedOn ||
        (source.retrievedFrom && source.retrievedFrom.length > 0) ||
        source.citation
    return (
        <div className="indicator-source">
            {source.description && (
                <p className="description">
                    <SimpleMarkdownText text={source.description.trim()} />
                </p>
            )}
            {showKeyInfo && (
                <div className="source-key-data-blocks">
                    {source.dataPublishedBy && (
                        <div className="source-key-data source-key-data--span-2">
                            <div className="source-key-data__title">
                                Data published by
                            </div>
                            <div>{source.dataPublishedBy}</div>
                        </div>
                    )}
                    {retrievedOn && (
                        <div className="source-key-data">
                            <div className="source-key-data__title">
                                Retrieved on
                            </div>
                            <div>{retrievedOn}</div>
                        </div>
                    )}
                    {source.retrievedFrom &&
                        source.retrievedFrom.length > 0 && (
                            <div className="source-key-data">
                                <div className="source-key-data__title">
                                    Retrieved from
                                </div>
                                {source.retrievedFrom.map((url: string) => (
                                    <div
                                        key={url}
                                        className="source-key-data__content--hide-overflow"
                                    >
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {url}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    {source.citation && (
                        <div className="source-key-data source-key-data--span-2">
                            <div className="source-key-data__title">
                                Citation
                            </div>
                            This is the citation of the original data obtained
                            from the source, prior to any processing or
                            adaptation by Our World in Data.{" "}
                            {props.isEmbeddedInADataPage && (
                                <>
                                    To cite data downloaded from this page,
                                    please use the suggested citation given in{" "}
                                    <a href={`#${REUSE_THIS_WORK_SECTION_ID}`}>
                                        Reuse This Work
                                    </a>{" "}
                                    below.
                                </>
                            )}
                            <CodeSnippet
                                code={source.citation.trim()}
                                theme="light"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
