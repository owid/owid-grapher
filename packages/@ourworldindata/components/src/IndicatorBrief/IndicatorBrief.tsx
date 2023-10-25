import React from "react"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"
import { dayjs } from "@ourworldindata/utils"
import { DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID } from "../SharedDataPageConstants.js"

interface IndicatorBriefProps {
    descriptionShort: string | undefined
    descriptionKey: string[] | undefined
    hasFaqEntries: boolean
    descriptionFromProducer: string | undefined
    attributionShort: string | undefined
    attribution: string
    processedAdapted: string
    dateRange: string | undefined
    lastUpdated: string
    nextUpdate: string | undefined
}

export const IndicatorBrief = (props: IndicatorBriefProps) => {
    let descriptionKeyBulletPointsOrText: JSX.Element | null = null
    const lastUpdated = dayjs(props.lastUpdated, ["YYYY", "YYYY-MM-DD"])
    if (props.descriptionKey)
        if (props.descriptionKey.length === 1)
            descriptionKeyBulletPointsOrText = (
                <SimpleMarkdownText text={props.descriptionKey[0]} />
            )
        else
            descriptionKeyBulletPointsOrText = (
                <ul className="article-block__list">
                    {props.descriptionKey.map((item, i) => (
                        <li key={i}>
                            <SimpleMarkdownText text={item} />
                        </li>
                    ))}
                </ul>
            )

    return (
        <>
            <div className="key-info__left">
                {(props.descriptionShort || props.descriptionKey) && (
                    <div className="key-info__curated">
                        {props.descriptionShort ? (
                            <>
                                <h2 className="key-info__title">
                                    About this data
                                </h2>
                                <div className="key-info__content article_block__text">
                                    <SimpleMarkdownText
                                        text={props.descriptionShort}
                                    />
                                </div>
                            </>
                        ) : null}
                        {props.descriptionKey ? (
                            <>
                                <h2 className="key-info__title">
                                    What you should know about this indicator
                                </h2>
                                <div className="key-info__content">
                                    {descriptionKeyBulletPointsOrText}
                                </div>
                            </>
                        ) : null}

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
                    />
                )}
            </div>
            <div className="key-info__right">
                <div className="key-data">
                    <div className="key-data__title">Source</div>
                    <div>
                        {props.attribution} – with{" "}
                        <a
                            href={`#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`}
                        >
                            {props.processedAdapted}
                        </a>{" "}
                        by Our World In Data
                    </div>
                </div>
                <div className="key-data">
                    <div className="key-data__title">Date range</div>
                    <div>{props.dateRange}</div>
                </div>
                <div className="key-data">
                    <div className="key-data__title">Last updated</div>
                    <div>{lastUpdated.format("MMMM D, YYYY")}</div>
                </div>
                {props.nextUpdate && (
                    <div className="key-data">
                        <div className="key-data__title">
                            Next expected update
                        </div>
                        <div>{props.nextUpdate}</div>
                    </div>
                )}
            </div>
        </>
    )
}
