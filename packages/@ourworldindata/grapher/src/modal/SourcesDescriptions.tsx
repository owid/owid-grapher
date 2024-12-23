import { faArrowDown } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    ExpandableToggle,
    HtmlOrSimpleMarkdownText,
    SimpleMarkdownText,
} from "@ourworldindata/components"

interface SourcesDescriptionsProps {
    descriptionShort?: string
    descriptionKey?: string[]
    descriptionFromProducer?: string
    attributionShort?: string
    additionalInfo?: string
    hasFaqEntries: boolean
    isEmbeddedInADataPage?: boolean // true by default
}

export const SourcesDescriptions = (props: SourcesDescriptionsProps) => {
    const isEmbeddedInADataPage = props.isEmbeddedInADataPage ?? true
    return (
        <div className="sources-descriptions">
            {props.descriptionKey && props.descriptionKey.length > 0 && (
                <div className="sources-description-key">
                    <h3 className="sources-description-key__title">
                        What you should know about this data
                    </h3>
                    <div className="sources-description-key__content">
                        {props.descriptionKey.length === 1 ? (
                            <SimpleMarkdownText
                                text={props.descriptionKey[0].trim()}
                            />
                        ) : (
                            <ul>
                                {props.descriptionKey.map((text, i) => (
                                    <li key={i}>
                                        <SimpleMarkdownText
                                            text={text.trim()}
                                            useParagraphs={false}
                                        />{" "}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {isEmbeddedInADataPage && props.hasFaqEntries && (
                        <a
                            className="sources-description-key__learn-more"
                            href="#faqs"
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
                                ? `How is this data described by its producer - ${props.attributionShort}?`
                                : "How is this data described by its producer?"
                        }
                        content={
                            <SimpleMarkdownText
                                text={props.descriptionFromProducer.trim()}
                            />
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
                            <HtmlOrSimpleMarkdownText
                                text={props.additionalInfo.trim()}
                            />
                        }
                    />
                )}
            </div>
        </div>
    )
}
