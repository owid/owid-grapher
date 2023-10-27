import React from "react"
import { faArrowDown } from "@fortawesome/free-solid-svg-icons/faArrowDown"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { SimpleMarkdownText } from "../SimpleMarkdownText.js"

interface IndicatorDescriptionsProps {
    descriptionShort?: string
    descriptionKey?: string[]
    descriptionFromProducer?: string
    attributionShort?: string
    additionalInfo?: string
    canonicalUrl?: string
    hasFaqEntries: boolean
}

export const IndicatorDescriptions = (
    props: IndicatorDescriptionsProps
) => {
    return (
        <div className="indicator-key-description">
            {props.descriptionKey && props.descriptionKey.length > 0 && (
                <div className="key-info">
                    <h3 className="key-info__title">
                        What you should know about this data
                    </h3>
                    <div className="key-info__content simple-markdown-text">
                        {props.descriptionKey.length === 1 ? (
                            <SimpleMarkdownText
                                text={props.descriptionKey[0]}
                            />
                        ) : (
                            <ul>
                                {props.descriptionKey.map((item, i) => (
                                    <li key={i}>
                                        <SimpleMarkdownText text={item} />{" "}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {props.hasFaqEntries && (
                        <a
                            className="key-info__learn-more"
                            href={(props.canonicalUrl ?? "") + "#faqs"}
                        >
                            Learn more in the FAQs
                            <FontAwesomeIcon icon={faArrowDown} />
                        </a>
                    )}
                </div>
            )}
            <div className="expandable-info-blocks">
                {props.descriptionFromProducer && (
                    <ExpandableToggle
                        label={
                            props.attributionShort
                                ? `How does the producer of this data - ${props.attributionShort} - describe this data?`
                                : "How does the producer of this data describe this data?"
                        }
                        content={
                            <div className="simple-markdown-text">
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
                            <div className="simple-markdown-text">
                                <SimpleMarkdownText
                                    text={props.additionalInfo}
                                />
                            </div>
                        }
                    />
                )}
            </div>
        </div>
    )
}
