import React, { useState, useLayoutEffect } from "react"
import {
    TagGraphNode,
    TagGraphRoot,
    getAllChildrenOfArea,
} from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons"
import classnames from "classnames"
import { SiteNavigationTopic } from "./SiteNavigationTopic.js"

export const SiteNavigationTopics = ({
    tagGraph,
    onClose,
    className,
}: {
    tagGraph: TagGraphRoot | null
    onClose: () => void
    className?: string
}) => {
    const [activeArea, setActiveArea] = useState<TagGraphNode | null>(
        tagGraph?.children[0] || null
    )

    const [numTopicColumns, setNumTopicColumns] = useState(1)

    // calculate the number of 10 topic columns we need based on the number of topics
    // using useLayoutEffect to avoid a flash of the wrong number of columns when switching categories
    useLayoutEffect(() => {
        if (activeArea) {
            const topics = getAllChildrenOfArea(activeArea)
            const numColumns = Math.ceil(topics.length / 10)
            setNumTopicColumns(numColumns)
        }
    }, [activeArea])

    const stopPropagation = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    return tagGraph?.children ? (
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
                    {tagGraph.children.map((area) => (
                        <li key={area.slug}>
                            <button
                                aria-label={`Toggle ${area.name} sub-menu`}
                                onClick={() => {
                                    setActiveArea(area)
                                }}
                                className={classnames({
                                    active: area === activeArea,
                                })}
                            >
                                <span>{area.name}</span>
                                <FontAwesomeIcon icon={faArrowRight} />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
            {activeArea && (
                <ul
                    className={classnames("topics", {
                        "columns-medium": numTopicColumns === 2,
                        "columns-large": numTopicColumns > 2,
                    })}
                    onClick={stopPropagation}
                >
                    {getAllChildrenOfArea(activeArea).map((topic) => (
                        <SiteNavigationTopic key={topic.slug} topic={topic} />
                    ))}
                </ul>
            )}
        </div>
    ) : null
}
