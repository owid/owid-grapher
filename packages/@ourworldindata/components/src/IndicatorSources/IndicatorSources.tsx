import React from "react"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { OwidOrigin, dayjs, uniqBy } from "@ourworldindata/utils"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"
import { CodeSnippet } from "../CodeSnippet/CodeSnippet.js"
import { REUSE_THIS_WORK_SECTION_ID } from "../SharedDataPageConstants.js"

export type OriginSubset = Pick<
    OwidOrigin,
    | "title"
    | "producer"
    | "descriptionSnapshot"
    | "dateAccessed"
    | "urlMain"
    | "description"
    | "citationFull"
>

export interface IndicatorSourcesProps {
    origins: OriginSubset[]
    isEmbeddedInADataPage?: boolean // true by default
}

export const IndicatorSources = (props: IndicatorSourcesProps) => {
    const isEmbeddedInADataPage = props.isEmbeddedInADataPage ?? true
    const origins = props.origins.map((origin) => ({
        ...origin,
        label: makeLabel(origin),
    }))
    const uniqueOrigins = uniqBy(origins, "label")

    return (
        <>
            {uniqueOrigins.map((source, idx: number, sources) => (
                <ExpandableToggle
                    key={source.label}
                    label={source.label}
                    content={
                        <SourceContent
                            source={source}
                            isEmbeddedInADataPage={isEmbeddedInADataPage}
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
    isEmbeddedInADataPage: boolean
}) => {
    const { source } = props
    const dateAccessed = source.dateAccessed
        ? dayjs(source.dateAccessed).format("MMMM D, YYYY")
        : undefined
    const showKeyInfo = dateAccessed || source.urlMain || source.citationFull
    return (
        <div className="indicator-source">
            {source.description && (
                <p className="description simple-markdown-text">
                    <SimpleMarkdownText text={source.description.trim()} />
                </p>
            )}
            {showKeyInfo && (
                <div className="source-key-data-blocks">
                    {dateAccessed && (
                        <div className="source-key-data">
                            <div className="source-key-data__title">
                                Retrieved on
                            </div>
                            <div>{dateAccessed}</div>
                        </div>
                    )}
                    {source.urlMain && (
                        <div className="source-key-data source-key-data--hide-overflow">
                            <div className="source-key-data__title">
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
                                code={source.citationFull.trim()}
                                theme="light"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

const makeLabel = (origin: OriginSubset) => {
    let label =
        origin.producer ??
        origin.descriptionSnapshot ??
        origin.description ??
        ""
    if (origin.title && origin.title !== label) {
        label += " - " + origin.title
    }
    return label
}
