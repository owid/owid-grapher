import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import * as React from "react"

export const AppliedTopicFiltersList = ({
    topics,
    removeTopic,
}: {
    topics: Set<string>
    removeTopic: (topic: string) => void
}) => {
    return (
        <ul className="data-catalog-applied-filters-list span-cols-12 col-start-2">
            {[...topics].map((topic) => {
                return (
                    <li
                        className="data-catalog-applied-filters-item"
                        key={topic}
                    >
                        <button
                            aria-label={`Remove filter ${topic}`}
                            className="data-catalog-applied-filters-button body-3-medium"
                            onClick={() => removeTopic(topic)}
                        >
                            {topic}
                            <FontAwesomeIcon icon={faClose} />
                        </button>
                    </li>
                )
            })}
        </ul>
    )
}
