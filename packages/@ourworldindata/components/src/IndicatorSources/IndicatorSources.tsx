import * as React from "react"
import cx from "classnames"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { DisplaySource, uniqBy, formatSourceDate } from "@ourworldindata/utils"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"
import { CodeSnippet } from "../CodeSnippet/CodeSnippet.js"
import { REUSE_THIS_WORK_SECTION_ID } from "../SharedDataPageConstants.js"
import { makeLinks } from "../IndicatorKeyData/IndicatorKeyData.js"

export interface IndicatorSourcesProps {
    sources: DisplaySource[]
    isEmbeddedInADataPage?: boolean // true by default
}

export const IndicatorSources = (props: IndicatorSourcesProps) => {
    const isEmbeddedInADataPage = props.isEmbeddedInADataPage ?? true
    const uniqueSources = uniqBy(props.sources, "label")

    return (
        <div
            className={cx("indicator-sources", {
                "indicator-sources--single": uniqueSources.length === 1,
            })}
        >
            {uniqueSources.map((source: DisplaySource, idx: number) => {
                const isStacked = idx !== uniqueSources.length - 1
                const content = (
                    <SourceContent
                        source={source}
                        isEmbeddedInADataPage={isEmbeddedInADataPage}
                    />
                )
                const useExpandableToggle =
                    source.description || source.citation
                return useExpandableToggle ? (
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
    const retrievedOn = formatSourceDate(source.retrievedOn, "MMMM D, YYYY")
    const showKeyInfo =
        source.dataPublishedBy ||
        retrievedOn ||
        (source.retrievedFrom && source.retrievedFrom.length > 0) ||
        source.citation
    return (
        <div className="source">
            {source.description && (
                <div className="description">
                    <SimpleMarkdownText text={source.description.trim()} />
                </div>
            )}
            {showKeyInfo && (
                <div className="source-key-data-blocks">
                    {source.dataPublishedBy && (
                        <div className="source-key-data source-key-data--span-2">
                            <div className="source-key-data__title">
                                Data published by
                            </div>
                            <div className="source-key-data__content">
                                <SimpleMarkdownText
                                    text={source.dataPublishedBy.trim()}
                                />
                            </div>
                        </div>
                    )}
                    {retrievedOn && (
                        <div
                            className={cx("source-key-data", {
                                "source-key-data--span-2":
                                    !source.retrievedFrom ||
                                    source.retrievedFrom.length === 0,
                            })}
                        >
                            <div className="source-key-data__title">
                                Retrieved on
                            </div>
                            <div className="source-key-data__content">
                                {retrievedOn}
                            </div>
                        </div>
                    )}
                    {source.retrievedFrom &&
                        source.retrievedFrom.length > 0 && (
                            <div
                                className={cx("source-key-data", {
                                    "source-key-data--span-2": !retrievedOn,
                                })}
                            >
                                <div className="source-key-data__title">
                                    Retrieved from
                                </div>
                                <div className="source-key-data__content">
                                    {makeLinks({ link: source.retrievedFrom })}
                                </div>
                            </div>
                        )}
                    {source.citation && (
                        <div className="source-key-data source-key-data-citation source-key-data--span-2">
                            <div className="source-key-data__title">
                                Citation
                            </div>
                            <div className="source-key-data__content">
                                This is the citation of the original data
                                obtained from the source, prior to any
                                processing or adaptation by Our World in Data.{" "}
                                {props.isEmbeddedInADataPage && (
                                    <>
                                        To cite data downloaded from this page,
                                        please use the suggested citation given
                                        in{" "}
                                        <a
                                            href={`#${REUSE_THIS_WORK_SECTION_ID}`}
                                        >
                                            Reuse This Work
                                        </a>{" "}
                                        below.
                                    </>
                                )}
                                <CodeSnippet
                                    code={source.citation.trim()}
                                    theme="light"
                                    useMarkdown={true}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
