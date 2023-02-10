import React, { useEffect, useLayoutEffect, useState } from "react"
import { CategoryWithEntries, EntryMeta } from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"
import classnames from "classnames"

// suppress useLayoutEffect (and its warnings) when not running in a browser
// https://gist.github.com/gaearon/e7d97cdf38a2907924ea12e4ebdf3c85?permalink_comment_id=4150784#gistcomment-4150784

// this is ok here because the layout effect below doesn't do anything until an
// other effect already triggered a paint, so there is no mismatch between the
// server and client on first paint (which is what the warning is about)
if (typeof window === "undefined") React.useLayoutEffect = () => {}

export const SiteNavigationTopics = () => {
    const [categorizedTopics, setCategorizedTopics] = useState<
        CategoryWithEntries[]
    >([])
    const [activeCategory, setActiveCategory] =
        useState<CategoryWithEntries | null>(null)

    useEffect(() => {
        const fetchCategorizedTopics = async () => {
            const response = await fetch("/headerMenu.json", {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    Accept: "application/json",
                },
            })
            const json = await response.json()
            setCategorizedTopics(json.categories)
        }
        fetchCategorizedTopics()
    }, [])

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

    return categorizedTopics.length > 0 ? (
        <div className="SiteNavigationTopics wrapper">
            <div className="categories">
                <div className="heading">Browse by topic</div>
                <ul>
                    {categorizedTopics.map((category) => (
                        <li key={category.slug}>
                            <button
                                onClick={() => setActiveCategory(category)}
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
                        "columns-large": numTopicColumns === 3,
                    })}
                >
                    {allTopicsInCategory(activeCategory).map((topic) => (
                        <Topic key={topic.slug} topic={topic} />
                    ))}
                </ul>
            )}
        </div>
    ) : null
}

const allTopicsInCategory = (category: CategoryWithEntries): EntryMeta[] => {
    return [
        ...category.entries,
        ...category.subcategories.flatMap((subcategory) => subcategory.entries),
    ]
}

const Topic = ({ topic }: { topic: EntryMeta }) => {
    return (
        <li>
            <a
                href={`/${topic.slug}`}
                className="item"
                data-track-note="header-navigation"
            >
                <span className="label">{topic.title}</span>
            </a>
        </li>
    )
}
