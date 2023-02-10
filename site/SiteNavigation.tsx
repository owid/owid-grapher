import React, { useEffect, useLayoutEffect, useState } from "react"
import ReactDOM from "react-dom"
import { faListUl } from "@fortawesome/free-solid-svg-icons/faListUl"
import { faCaretDown } from "@fortawesome/free-solid-svg-icons/faCaretDown"
import {
    NewsletterSubscription,
    NewsletterSubscriptionContext,
} from "./NewsletterSubscription.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faSearch } from "@fortawesome/free-solid-svg-icons/faSearch"
import { CategoryWithEntries, EntryMeta } from "@ourworldindata/utils"
import classnames from "classnames"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"

// suppress useLayoutEffect (and its warnings) when not running in a browser
// https://gist.github.com/gaearon/e7d97cdf38a2907924ea12e4ebdf3c85?permalink_comment_id=4150784#gistcomment-4150784

// this is ok here because the layout effect below doesn't do anything until an
// other effect already triggered a paint, so there is no mismatch between the
// server and client on first paint (which is what the warning is about)
if (typeof window === "undefined") React.useLayoutEffect = () => {}

export const SiteNavigation = ({ baseUrl }: { baseUrl: string }) => {
    const [categorizedTopics, setCategorizedTopics] = useState<
        CategoryWithEntries[]
    >([])
    const [activeCategory, setActiveCategory] =
        useState<CategoryWithEntries | null>(null)
    const [numTopicColumns, setNumTopicColumns] = useState(1)

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

    // select the first category if none is selected
    useEffect(() => {
        if (categorizedTopics.length > 0 && !activeCategory) {
            setActiveCategory(categorizedTopics[0])
        }
    }, [categorizedTopics, activeCategory])

    // calculate the number of 10 topic columns we need based on the number of topics
    // using useLayoutEffect to avoid a flash of the wrong number of columns when switching categories
    useLayoutEffect(() => {
        if (activeCategory) {
            const topics = allTopicsInCategory(activeCategory)
            const numColumns = Math.ceil(topics.length / 10)
            setNumTopicColumns(numColumns)
        }
    }, [activeCategory])

    return (
        <div className="site-navigation-bar wrapper">
            <div className="site-logos">
                <div className="logo-owid">
                    <a href="/">
                        Our World
                        <br /> in Data
                    </a>
                </div>
                <div className="logos-wrapper">
                    <a
                        href="https://www.oxfordmartin.ox.ac.uk/global-development"
                        className="oxford-logo"
                    >
                        <img
                            src={`${baseUrl}/oms-logo.svg`}
                            alt="Oxford Martin School logo"
                        />
                    </a>
                    <a
                        href="https://global-change-data-lab.org/"
                        className="gcdl-logo"
                    >
                        <img
                            src={`${baseUrl}/gcdl-logo.svg`}
                            alt="Global Change Data Lab logo"
                        />
                    </a>
                </div>
            </div>
            <nav className="site-primary-links">
                <ul>
                    <li>
                        <button>
                            <FontAwesomeIcon
                                icon={faListUl}
                                style={{ marginRight: "8px" }}
                            />
                            Browse by topic
                        </button>
                    </li>
                    <li>
                        <a href="/blog">Latest</a>
                    </li>
                    <li>
                        <button>
                            Resources
                            <FontAwesomeIcon
                                icon={faCaretDown}
                                style={{ marginLeft: "8px" }}
                            />
                        </button>
                    </li>
                    <li>
                        <button>
                            About
                            <FontAwesomeIcon
                                icon={faCaretDown}
                                style={{ marginLeft: "8px" }}
                            />
                        </button>
                    </li>
                </ul>
            </nav>
            {categorizedTopics.length > 0 && (
                <div className="site-topics wrapper">
                    <div className="categories">
                        <div className="heading">Browse by topic</div>
                        <ul>
                            {categorizedTopics.map((category) => (
                                <li key={category.slug}>
                                    <button
                                        onClick={() =>
                                            setActiveCategory(category)
                                        }
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
                            {allTopicsInCategory(activeCategory).map((topic) =>
                                renderTopic(topic)
                            )}
                        </ul>
                    )}
                </div>
            )}
            <div className="site-search-cta">
                <form className="HeaderSearch" action="/search" method="GET">
                    <input
                        name="search"
                        placeholder="Search for a topic or chart..."
                    />
                    <div className="icon">
                        <FontAwesomeIcon icon={faSearch} />
                    </div>
                </form>
                <NewsletterSubscription
                    context={NewsletterSubscriptionContext.Floating}
                />
                <a
                    href="/donate"
                    className="donate"
                    data-track-note="header-navigation"
                >
                    Donate
                </a>
            </div>
        </div>
    )
}

const allTopicsInCategory = (category: CategoryWithEntries): EntryMeta[] => {
    return [
        ...category.entries,
        ...category.subcategories.flatMap((subcategory) => subcategory.entries),
    ]
}

const renderTopic = (topic: EntryMeta): JSX.Element => {
    return (
        <li key={topic.slug}>
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

export const runSiteNavigation = (baseUrl: string) => {
    ReactDOM.render(
        <SiteNavigation baseUrl={baseUrl} />,
        document.querySelector(".site-navigation-root")
    )
}
