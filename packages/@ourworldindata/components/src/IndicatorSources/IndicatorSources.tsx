import React from "react"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { OwidOrigin } from "@ourworldindata/utils"
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
}

export const IndicatorSources = (props: IndicatorSourcesProps) => {
    const citationFullBlockFn = (source: OriginSubset) => {
        source.citationFull && (
            <div
                className="key-data"
                style={{
                    gridColumn: "span 2",
                }}
            >
                <div className="key-data__title--dark">Citation</div>
                This is the citation of the original data obtained from the
                source, prior to any processing or adaptation by Our World in
                Data. To cite data downloaded from this page, please use the
                suggested citation given in{" "}
                <a href={"#" + REUSE_THIS_WORK_SECTION_ID}>
                    Reuse This Work
                </a>{" "}
                below.
                <CodeSnippet code={source.citationFull} theme="light" />
            </div>
        )
    }
    return (
        <div className="data-sources grid span-cols-12">
            <h3 className="data-sources__heading span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                This data is based on the following sources
            </h3>
            <div className="col-start-4 span-cols-6 col-lg-start-5 span-lg-cols-7 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12">
                {props.origins.map((source, idx: number, sources) => {
                    return (
                        <div className="data-sources__source-item" key={idx}>
                            <ExpandableToggle
                                label={
                                    source.producer ??
                                    source.descriptionSnapshot ??
                                    source.description ??
                                    ""
                                }
                                isStacked={idx !== sources.length - 1}
                                hasTeaser
                                content={
                                    <>
                                        {source.description && (
                                            <p className="article-block__text">
                                                <SimpleMarkdownText
                                                    text={source.description}
                                                />
                                            </p>
                                        )}
                                        {(source.dateAccessed ||
                                            source.urlMain) && (
                                            <div
                                                className="grid source__key-data"
                                                style={{
                                                    gridTemplateColumns:
                                                        "minmax(0,1fr) minmax(0,2fr)",
                                                }}
                                            >
                                                {source.dateAccessed && (
                                                    <div className="key-data">
                                                        <div className="key-data__title--dark">
                                                            Retrieved on
                                                        </div>
                                                        <div>
                                                            {
                                                                source.dateAccessed
                                                            }
                                                        </div>
                                                    </div>
                                                )}
                                                {source.urlMain && (
                                                    <div className="key-data key-data--hide-overflow">
                                                        <div className="key-data__title--dark">
                                                            Retrieved from
                                                        </div>
                                                        <div>
                                                            <a
                                                                href={
                                                                    source.urlMain
                                                                }
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                {source.urlMain}
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                {citationFullBlockFn(source)}
                                            </div>
                                        )}
                                    </>
                                }
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
