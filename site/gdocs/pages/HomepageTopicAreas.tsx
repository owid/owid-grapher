import * as React from "react"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faChevronDown,
    faChevronUp,
    faFlask,
} from "@fortawesome/free-solid-svg-icons"
import { TagGraphNode } from "@ourworldindata/types"
import { getAllChildrenOfArea } from "@ourworldindata/utils"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { BespokeComponent } from "../components/BespokeComponent.js"
import {
    HOMEPAGE_AREA_CONTENT,
    HomepageFeaturedLink,
} from "./homepageTopicAreasContent.js"

const NUM_TOPICS_SHOWN_COLLAPSED = 6

const EMBED_LAYOUT_CLASSES: Record<string, string> = {
    narrow: "col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
    wide: "col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2",
    widest: "span-cols-12 col-start-2",
}

const FEATURED_LINK_TYPE_LABELS: Record<
    HomepageFeaturedLink["type"],
    string
> = {
    article: "Article",
    explorer: "Data Explorer",
    chart: "Interactive Chart",
}

const makeAreaId = (name: string): string =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

const TopicsList = ({
    areaName,
    topics,
}: {
    areaName: string
    topics: TagGraphNode[]
}) => {
    const [isExpanded, setIsExpanded] = React.useState(false)
    const visibleTopics = isExpanded
        ? topics
        : topics.slice(0, NUM_TOPICS_SHOWN_COLLAPSED)
    const numHidden = topics.length - NUM_TOPICS_SHOWN_COLLAPSED

    return (
        <div className="homepage-topic-area__topics">
            <h3 className="overline-black-caps">Topics</h3>
            <ul>
                {visibleTopics.map((topic) => (
                    <li key={topic.slug}>
                        <a
                            href={`/${topic.slug}`}
                            data-track-note="homepage_topic_area_topic"
                        >
                            {topic.name}
                        </a>
                    </li>
                ))}
                {numHidden > 0 && (
                    <li>
                        <button
                            type="button"
                            className="homepage-topic-area__topics-toggle"
                            aria-expanded={isExpanded}
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? (
                                <>
                                    Show fewer topics
                                    <FontAwesomeIcon icon={faChevronUp} />
                                </>
                            ) : (
                                <>
                                    See all {topics.length} topics in{" "}
                                    {areaName.toLowerCase()}
                                    <FontAwesomeIcon icon={faChevronDown} />
                                </>
                            )}
                        </button>
                    </li>
                )}
            </ul>
        </div>
    )
}

const FeaturedLinks = ({ links }: { links: HomepageFeaturedLink[] }) => {
    if (!links.length) return null
    return (
        <div className="homepage-topic-area__featured">
            <h3 className="overline-black-caps">Featured</h3>
            <ul className="homepage-topic-area__featured-list">
                {links.map((link) => (
                    <li key={link.href}>
                        <a
                            className="homepage-topic-area__featured-card"
                            href={link.href}
                            data-track-note="homepage_topic_area_featured"
                        >
                            <span className="homepage-topic-area__featured-type">
                                {FEATURED_LINK_TYPE_LABELS[link.type]}
                            </span>
                            <span className="homepage-topic-area__featured-title">
                                {link.title}
                                <FontAwesomeIcon icon={faArrowRight} />
                            </span>
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    )
}

const TopicAreaSection = ({ area }: { area: TagGraphNode }) => {
    const content = HOMEPAGE_AREA_CONTENT[area.name]
    const topics = getAllChildrenOfArea(area).filter(
        (topic) => topic.isTopic && topic.slug
    )
    const embed = content?.embed

    return (
        <section
            id={makeAreaId(area.name)}
            className="homepage-topic-area grid grid-cols-12-full-width span-cols-14"
        >
            <h2 className="homepage-topic-area__name h2-bold span-cols-12 col-start-2">
                {area.name}
            </h2>
            {embed && (
                <figure
                    className={cx(
                        "homepage-topic-area__embed",
                        EMBED_LAYOUT_CLASSES[embed.block.size] ??
                            EMBED_LAYOUT_CLASSES.widest
                    )}
                >
                    <BespokeComponent block={embed.block} />
                    <figcaption className="homepage-topic-area__embed-caption body-3-medium">
                        {embed.isDraft && (
                            <span className="homepage-topic-area__draft-badge">
                                <FontAwesomeIcon icon={faFlask} />
                                Work in progress
                            </span>
                        )}
                        <a href={embed.sourceHref}>
                            From: {embed.sourceTitle}
                            <FontAwesomeIcon icon={faArrowRight} />
                        </a>
                    </figcaption>
                </figure>
            )}
            <div className="homepage-topic-area__links span-cols-12 col-start-2">
                {content && <FeaturedLinks links={content.featured} />}
                <TopicsList areaName={area.name} topics={topics} />
            </div>
        </section>
    )
}

export const HomepageTopicAreas = () => {
    const { homepageMetadata } = React.useContext(AttachmentsContext)
    const tagGraph = homepageMetadata?.tagGraph
    if (!tagGraph) return null

    return (
        // The footer links to #all-topics — keep that anchor working
        <section
            id="all-topics"
            className="homepage-topic-areas grid grid-cols-12-full-width span-cols-14"
        >
            <header className="homepage-topic-areas__header span-cols-12 col-start-2">
                <h2 className="h1-semibold">Explore our world, area by area</h2>
                <p className="subtitle-1">
                    All our data, research, and writing, organized by the big
                    areas of work — with some of our interactive
                    visualizations to explore along the way.
                </p>
            </header>
            {tagGraph.children.map((area) => (
                <TopicAreaSection area={area} key={area.name} />
            ))}
        </section>
    )
}
