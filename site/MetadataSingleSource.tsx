import * as React from "react"
import { DisplaySource } from "@ourworldindata/types"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { formatSourceDate } from "@ourworldindata/utils"

// Renders the `<a>` for a source-retrieved-from URL with a tidy display
// (strips scheme), opens in a new tab.
const SourceLink = ({ href }: { href: string }): React.ReactElement => {
    const displayText = href.replace(/^https?:\/\//, "")
    return (
        <a href={href} target="_blank" rel="noreferrer">
            {displayText}
        </a>
    )
}

// Detail panel for a single source — used inside each row of the data
// sources list when the user expands a source. Renders the retrieved-on
// line first, then (optionally) the indicator-level "How is this data
// described by its producer?" text folded in for the primary source, the
// source's own description (with an "About the source" header when both
// are present), the dataPublishedBy field, and the source-attribution
// citation as fine-print at the end.
export const MetadataSingleSource = ({
    source,
    descriptionFromProducer,
}: {
    source: DisplaySource
    // Indicator-level producer description, folded into a single source's
    // detail panel (the primary one) instead of rendering as its own
    // top-level subsection of the metadata box.
    descriptionFromProducer?: string
}): React.ReactElement => {
    const retrievedOn = formatSourceDate(source.retrievedOn, "MMMM D, YYYY")

    return (
        <div className="indicator-sources indicator-sources--single">
            <div className="source">
                {(retrievedOn || source.retrievedFrom) && (
                    <div className="source-key-data-blocks">
                        <div className="source-key-data source-key-data--span-2 source-key-data--retrieved">
                            <div className="source-key-data__content">
                                {retrievedOn && source.retrievedFrom ? (
                                    <>
                                        Retrieved on {retrievedOn} from{" "}
                                        <SourceLink
                                            href={source.retrievedFrom}
                                        />
                                    </>
                                ) : retrievedOn ? (
                                    <>Retrieved on {retrievedOn}</>
                                ) : (
                                    <>
                                        Retrieved from{" "}
                                        <SourceLink
                                            href={source.retrievedFrom!}
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {descriptionFromProducer && (
                    <div className="source-key-data-blocks">
                        <div className="source-key-data source-key-data--span-2 source-key-data-producer-description">
                            <div className="source-key-data__title">
                                How is this data described by its producer?
                            </div>
                            <div className="source-key-data__content">
                                <SimpleMarkdownText
                                    text={descriptionFromProducer.trim()}
                                />
                            </div>
                        </div>
                    </div>
                )}
                {source.description &&
                    (descriptionFromProducer ? (
                        // When descriptionFromProducer is present we have
                        // two prose blocks back-to-back — give the source's
                        // own description an "About the source" header so
                        // the two are clearly distinct sections.
                        <div className="source-key-data-blocks">
                            <div className="source-key-data source-key-data--span-2 source-key-data-about-source">
                                <div className="source-key-data__title">
                                    About the source
                                </div>
                                <div className="source-key-data__content">
                                    <SimpleMarkdownText
                                        text={source.description.trim()}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="description">
                            <SimpleMarkdownText
                                text={source.description.trim()}
                            />
                        </div>
                    ))}
                {source.dataPublishedBy && (
                    <div className="source-key-data-blocks">
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
                    </div>
                )}
                {source.citation && (
                    <div className="source-key-data-blocks">
                        <div className="source-key-data source-key-data-citation source-key-data--span-2">
                            <div className="source-key-data__title">
                                Source attribution
                            </div>
                            <div className="source-key-data__content">
                                <SimpleMarkdownText
                                    text={source.citation.trim()}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
