import { TopicPill } from "./TopicPill"

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
            style={{ marginTop: 16 }}
        >
            {[...topics].map((topic) => (
                <li key={topic}>
                    <TopicPill name={topic} onRemove={removeTopic} />
                </li>
            ))}
        </ul>
    )
}
