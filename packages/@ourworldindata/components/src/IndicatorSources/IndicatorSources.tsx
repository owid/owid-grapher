import * as _ from "lodash-es"
import * as React from "react"
import cx from "clsx"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { DisplaySource, formatSourceDate } from "@ourworldindata/utils"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"
import { CodeSnippet } from "../CodeSnippet/CodeSnippet.js"
import { REUSE_THIS_WORK_SECTION_ID } from "../SharedDataPageConstants.js"
import { makeLinks } from "../IndicatorKeyData/IndicatorKeyData.js"

export interface IndicatorSourcesProps {
    sources: DisplaySource[]
    isEmbeddedInADataPage?: boolean // true by default
    hideReuseThisWorkText?: boolean
    hideTeasers?: boolean
    /** Called when an expandable source toggle is expanded or collapsed.
     * `index` is the position of the source among the deduplicated sources. */
    onSourceToggle?: (
        source: DisplaySource,
        index: number,
        isOpen: boolean
    ) => void
    retrievedFromTrackNote?: string
    descriptionTrackNote?: string
    dodTrackNote?: string
    /** Open links in a new tab, e.g. when rendered inside an iframe whose
     *  host page can't be navigated away from. */
    openLinksInNewTab?: boolean
}

export const IndicatorSources = (props: IndicatorSourcesProps) => {
    const isEmbeddedInADataPage = props.isEmbeddedInADataPage ?? true
    const uniqueSources = _.uniqBy(props.sources, "label")

    return (
        <div
            className={cx("indicator-sources", {
                "indicator-sources--single": uniqueSources.length === 1,
            })}
        >
            {uniqueSources.map((source: DisplaySource, idx: number) => {
                const content = (
                    <SourceContent
                        source={source}
                        isEmbeddedInADataPage={isEmbeddedInADataPage}
                        hideReuseThisWorkText={props.hideReuseThisWorkText}
                        retrievedFromTrackNote={props.retrievedFromTrackNote}
                        descriptionTrackNote={props.descriptionTrackNote}
                        dodTrackNote={props.dodTrackNote}
                        openLinksInNewTab={props.openLinksInNewTab}
                    />
                )
                const useExpandableToggle =
                    source.description ||
                    source.citation ||
                    source.variants?.length
                return useExpandableToggle ? (
                    <ExpandableToggle
                        key={source.label}
                        label={source.label}
                        content={content}
                        hasTeaser={!props.hideTeasers}
                        onToggle={
                            props.onSourceToggle
                                ? (isOpen) =>
                                      props.onSourceToggle?.(
                                          source,
                                          idx,
                                          isOpen
                                      )
                                : undefined
                        }
                    />
                ) : (
                    <NonExpandable
                        key={source.label}
                        label={source.label}
                        content={content}
                    />
                )
            })}
        </div>
    )
}

const NonExpandable = (props: { label: string; content: React.ReactNode }) => {
    return (
        <div className="NonExpandable">
            <h4 className="NonExpandable__title">{props.label}</h4>
            <div className="NonExpandable__content">{props.content}</div>
        </div>
    )
}

const SourceContent = (props: {
    source: DisplaySource
    isEmbeddedInADataPage: boolean
    hideReuseThisWorkText?: boolean
    retrievedFromTrackNote?: string
    descriptionTrackNote?: string
    dodTrackNote?: string
    openLinksInNewTab?: boolean
}) => {
    const { source } = props
    const retrievedOn = formatSourceDate(source.retrievedOn, "MMMM D, YYYY")
    const variants = source.variants?.length ? source.variants : undefined
    const showKeyInfo =
        source.dataPublishedBy ||
        retrievedOn ||
        (source.retrievedFrom && source.retrievedFrom.length > 0) ||
        source.citation ||
        variants
    return (
        <div className="source">
            {source.description && (
                <div className="description">
                    <SimpleMarkdownText
                        text={source.description.trim()}
                        dataTrackNote={props.descriptionTrackNote}
                        dodTrackNote={props.dodTrackNote}
                        openLinksInNewTab={props.openLinksInNewTab}
                    />
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
                                    dataTrackNote={props.descriptionTrackNote}
                                    dodTrackNote={props.dodTrackNote}
                                    openLinksInNewTab={props.openLinksInNewTab}
                                />
                            </div>
                        </div>
                    )}
                    {retrievedOn && (
                        <div
                            className={cx("source-key-data", {
                                "source-key-data--span-2":
                                    !!variants ||
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
                    {variants &&
                        variants.map((v, i) => (
                            <div
                                key={`${i}-${v.label}`}
                                className="source-key-data source-key-data--span-2 source-key-data--variant"
                            >
                                <div className="source-key-data__title">
                                    {v.label}
                                </div>
                                <div className="source-key-data__content">
                                    {v.retrievedFrom && (
                                        <div className="source-key-data__variant-row">
                                            Retrieved from{" "}
                                            {makeLinks({
                                                link: v.retrievedFrom,
                                            })}
                                        </div>
                                    )}
                                    {v.citation && (
                                        <CodeSnippet
                                            code={v.citation.trim()}
                                            theme="light"
                                            useMarkdown={true}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    {!variants &&
                        source.retrievedFrom &&
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
                                    {makeLinks({
                                        link: source.retrievedFrom,
                                        trackNote: props.retrievedFromTrackNote,
                                        openLinksInNewTab:
                                            props.openLinksInNewTab,
                                    })}
                                </div>
                            </div>
                        )}
                    {!variants && source.citation && (
                        <div className="source-key-data source-key-data-citation source-key-data--span-2">
                            <div className="source-key-data__title">
                                Citation
                            </div>
                            <div className="source-key-data__content">
                                This is the citation of the original data
                                obtained from the source, prior to any
                                processing or adaptation by Our World in Data.{" "}
                                {props.isEmbeddedInADataPage &&
                                    !props.hideReuseThisWorkText && (
                                        <>
                                            To cite data downloaded from this
                                            page, please use the suggested
                                            citation given in{" "}
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
