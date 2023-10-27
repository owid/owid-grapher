import React from "react"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { OwidOrigin, dayjs, uniqBy } from "@ourworldindata/utils"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"
import { CodeSnippet } from "../CodeSnippet/CodeSnippet.js"
import { REUSE_THIS_WORK_SECTION_ID } from "../SharedDataPageConstants.js"

export type OriginSubset = Pick<
    OwidOrigin,
    | "producer"
    | "descriptionSnapshot"
    | "dateAccessed"
    | "urlMain"
    | "description"
    | "citationFull"
>

export interface IndicatorSourcesProps {
    origins: OriginSubset[]
    canonicalUrl?: string
}

export const IndicatorSources = (props: IndicatorSourcesProps) => {
    const origins = props.origins.map((origin) => ({
        ...origin,
        label:
            origin.producer ??
            origin.descriptionSnapshot ??
            origin.description ??
            "",
    }))
    const uniqueOrigins = uniqBy(
        origins,
        (origin) => origin.label + origin.description
    )

    return (
        <>
            {uniqueOrigins.map((source, idx: number, sources) => (
                <ExpandableToggle
                    key={source.label}
                    label={source.label}
                    content={
                        <SourceContent
                            source={source}
                            canonicalUrl={props.canonicalUrl}
                        />
                    }
                    isStacked={idx !== sources.length - 1}
                    hasTeaser
                />
            ))}
        </>
    )
}

const SourceContent = (props: {
    source: OriginSubset
    canonicalUrl?: string
}) => {
    const { source, canonicalUrl = "" } = props
    const dateAccessed = source.dateAccessed
        ? dayjs(source.dateAccessed).format("MMMM D, YYYY")
        : undefined
    const showKeyInfo = dateAccessed || source.urlMain || source.citationFull
    return (
        <div className="source-content">
            {source.description && (
                <p className="description simple-markdown-text">
                    <SimpleMarkdownText text={source.description} />
                </p>
            )}
            {showKeyInfo && (
                <div className="key-info">
                    {dateAccessed && (
                        <div className="key-data">
                            <div className="key-data__title">Retrieved on</div>
                            <div>{dateAccessed}</div>
                        </div>
                    )}
                    {source.urlMain && (
                        <div className="key-data key-data--hide-overflow">
                            <div className="key-data__title">
                                Retrieved from
                            </div>
                            <div>
                                <a
                                    href={source.urlMain}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {source.urlMain}
                                </a>
                            </div>
                        </div>
                    )}
                    {source.citationFull && (
                        <div className="key-data key-data--span-2">
                            <div className="key-data__title">Citation</div>
                            This is the citation of the original data obtained
                            from the source, prior to any processing or
                            adaptation by Our World in Data. To cite data
                            downloaded from this page, please use the suggested
                            citation given in{" "}
                            <a
                                href={`${canonicalUrl}#${REUSE_THIS_WORK_SECTION_ID}`}
                            >
                                Reuse This Work
                            </a>{" "}
                            below.
                            <CodeSnippet
                                code={source.citationFull}
                                theme="light"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
