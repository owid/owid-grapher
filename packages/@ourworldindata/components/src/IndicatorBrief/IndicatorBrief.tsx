import React from "react"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"
import { dayjs } from "@ourworldindata/utils"
import { DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID } from "../SharedDataPageConstants.js"

interface IndicatorBriefProps {
    title: string
    descriptionShort?: string
    descriptionKey?: string[]
    hasFaqEntries: boolean
    descriptionFromProducer?: string
    attributionShort?: string
    attribution: string
    processedAdapted: string
    dateRange?: string
    lastUpdated: string
    nextUpdate?: string
    additionalInfo?: string
    unit?: string
}

export const IndicatorBrief = (props: IndicatorBriefProps) => {
    const lastUpdated = dayjs(props.lastUpdated, ["YYYY", "YYYY-MM-DD"])
    const keyDataCount = 3 + (props.nextUpdate ? 1 : 0) + (props.unit ? 1 : 0)
    return (
        <>
            <div>
                <div className="about-this-data">
                    <h2 className="about-this-data__heading">
                        About this data
                    </h2>
                    {props.descriptionShort && (
                        <>
                            <div className="about-this-data__indicator-title">
                                {props.title}
                            </div>
                            <p className="about-this-data__indicator-description">
                                <SimpleMarkdownText
                                    text={props.descriptionShort}
                                />
                            </p>
                        </>
                    )}
                    <div className="key-data">
                        <div className="key-data__title">Source</div>
                        <div className="key-data__content key-data__content-source">
                            {props.attribution} – with{" "}
                            <a
                                href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                            >
                                {props.processedAdapted}
                            </a>{" "}
                            by Our World In Data
                        </div>
                        <div className="key-data__title">Last updated</div>
                        <div className="key-data__content">
                            {lastUpdated.format("MMMM D, YYYY")}
                        </div>
                        {props.nextUpdate && (
                            <>
                                <div className="key-data__title">
                                    Next expected update
                                </div>
                                <div className="key-data__content">
                                    {props.nextUpdate}
                                </div>
                            </>
                        )}
                        <div className="key-data__title">Date range</div>
                        <div className="key-data__content">
                            {props.dateRange}
                        </div>
                        {props.unit && (
                            <>
                                <div className="key-data__title">Unit</div>
                                <div className="key-data__content">
                                    {props.unit}
                                </div>
                            </>
                        )}
                        {/* needed for its top-border */}
                        {keyDataCount % 2 === 0 && (
                            <>
                                <div className="key-data__title" />
                                <div className="key-data__content" />
                            </>
                        )}
                    </div>
                </div>
                {props.descriptionKey && (
                    <div className="key-info">
                        <h3 className="key-info__title">
                            What you should know about this indicator
                        </h3>
                        <div className="key-info__content">
                            {props.descriptionKey.length === 1 ? (
                                <SimpleMarkdownText
                                    text={props.descriptionKey[0]}
                                />
                            ) : (
                                <ul className="article-block__list">
                                    {props.descriptionKey.map((item, i) => (
                                        <li key={i}>
                                            <SimpleMarkdownText text={item} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {props.hasFaqEntries && (
                            <a className="key-info__learn-more" href="#faqs">
                                Learn more in the FAQs
                                <FontAwesomeIcon icon={faArrowDown} />
                            </a>
                        )}
                    </div>
                )}
                {props.descriptionFromProducer && (
                    <ExpandableToggle
                        label={
                            props.attributionShort
                                ? `How does the producer of this data - ${props.attributionShort} - describe this data?`
                                : "How does the producer of this data describe this data?"
                        }
                        content={
                            <div className="article-block__text">
                                <SimpleMarkdownText
                                    text={props.descriptionFromProducer}
                                />
                            </div>
                        }
                        isExpandedDefault={
                            !(props.descriptionShort || props.descriptionKey)
                        }
                        isStacked={!!props.additionalInfo}
                    />
                )}
                {props.additionalInfo && (
                    <ExpandableToggle
                        label="Additional information about this data"
                        content={
                            <SimpleMarkdownText text={props.additionalInfo} />
                        }
                    />
                )}
            </div>
        </>
    )
}
