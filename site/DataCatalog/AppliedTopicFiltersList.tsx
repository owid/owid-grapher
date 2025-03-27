import { faClose } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const AppliedTopicFiltersList = ({
    topics,
    removeTopic,
}: {
    topics: Set<string>
    removeTopic: (topic: string) => void
}) => {
    // Only render if there are topics
    if (topics.size === 0) return null

    return (
        <ul
            className="data-catalog-applied-filters-list span-cols-12 col-start-2"
            style={{ marginTop: 32 }}
        >
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
