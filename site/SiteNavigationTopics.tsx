import { useLayoutEffect, useState } from "react"
import * as React from "react"
import { CategoryWithEntries } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import classnames from "classnames"
import { SiteNavigationTopic } from "./SiteNavigationTopic.js"
import { allTopicsInCategory } from "./gdocs/utils.js"

export const SiteNavigationTopics = ({
    topics,
    onClose,
    className,
}: {
    topics: CategoryWithEntries[]
    onClose: () => void
    className?: string
}) => {
    const [activeCategory, setActiveCategory] =
        useState<CategoryWithEntries | null>(topics[0])

    const [numTopicColumns, setNumTopicColumns] = useState(1)

    // calculate the number of 10 topic columns we need based on the number of topics
    // using useLayoutEffect to avoid a flash of the wrong number of columns when switching categories
    useLayoutEffect(() => {
        if (activeCategory) {
            const topics = allTopicsInCategory(activeCategory)
            const numColumns = Math.ceil(topics.length / 10)
            setNumTopicColumns(numColumns)
        }
    }, [activeCategory])

    const stopPropagation = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    return topics.length > 0 ? (
        <div
            className={classnames("SiteNavigationTopics", className)}
            // hack: this is to make sure the overlay is closed when clicking
            // the - visually - empty space to the right of the topics menu. A
            // click on the overlay in this area looks like a click on the
            // overlay but is actually a click on the remaining grid columns of
            // the menu. We then need to use stopPropagation to prevent clicks
            // within the visible portion of the menu to bubble up and close the
            // menu (and the overlay).
            onClick={onClose}
        >
            <div className="categories" onClick={stopPropagation}>
                <div className="heading">Browse by topic</div>
                <ul>
                    {topics.map((category) => (
                        <li key={category.slug}>
                            <button
                                aria-label={`Toggle ${category.name} sub-menu`}
                                onClick={() => {
                                    setActiveCategory(category)
                                }}
                                className={classnames({
                                    active: category === activeCategory,
                                })}
                            >
                                <span>{category.name}</span>
                                <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            {activeCategory && (
                <ul
                    className={classnames("topics", {
                        "columns-medium": numTopicColumns === 2,
                        "columns-large": numTopicColumns > 2,
                    })}
                    onClick={stopPropagation}
                >
                    {allTopicsInCategory(activeCategory).map((topic) => (
                        <SiteNavigationTopic key={topic.slug} topic={topic} />
                    ))}
                </ul>
            )}
        </div>
    ) : null
}
