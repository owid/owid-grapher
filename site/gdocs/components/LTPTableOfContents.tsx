import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faBook,
    faChartSimple,
} from "@fortawesome/free-solid-svg-icons"
import { TocHeadingWithTitleSupertitle, Url } from "@ourworldindata/utils"
import { SearchResultType, SearchState } from "@ourworldindata/types"
import {
    createTopicFilter,
    SEARCH_BASE_PATH,
} from "../../search/searchUtils.js"
import { searchStateToUrl } from "../../search/searchState.js"

const DEFAULT_TITLE = "Contents"
const SECONDARY_CARDS = [
    {
        id: "data",
        title: "Data",
        description: "See all charts",
        icon: faChartSimple,
        resultType: SearchResultType.DATA,
    },
    {
        id: "writing",
        title: "Writing",
        description: "See all articles and insights",
        icon: faBook,
        resultType: SearchResultType.WRITING,
    },
] as const

type Props = {
    toc?: TocHeadingWithTitleSupertitle[]
    className?: string
    title?: string
    tagName: string
}

export const LTPTableOfContents = ({
    toc,
    className,
    title,
    tagName,
}: Props) => {
    if (!toc || toc.length === 0) return null

    const resolvedTitle = title ?? DEFAULT_TITLE
    const resourceSectionTitle = `All our work on ${tagName}`

    const resourceCards = SECONDARY_CARDS.map((card) => ({
        ...card,
        href: buildSearchHrefForCard(card.resultType, tagName),
    }))

    return (
        <nav className={className} aria-label={resolvedTitle}>
            <div className="article-block__ltp-toc__primary span-cols-5 span-md-cols-6 span-sm-cols-12">
                <p className="article-block__ltp-toc__primary-title">
                    {resolvedTitle}
                </p>
                <ul className="article-block__ltp-toc__primary-list">
                    {toc.map(({ slug, title: headingTitle, text }) => {
                        const displayTitle = headingTitle || text
                        if (!slug || !displayTitle) return null
                        return (
                            <li
                                key={slug}
                                className="article-block__ltp-toc__primary-item"
                            >
                                <a
                                    href={`#${slug}`}
                                    className="article-block__ltp-toc__primary-link"
                                    data-track-note="toc_link"
                                >
                                    {displayTitle}
                                </a>
                            </li>
                        )
                    })}
                </ul>
            </div>
            <div className="article-block__ltp-toc__secondary span-cols-3 span-md-cols-4 span-sm-cols-12">
                <p className="article-block__ltp-toc__secondary-title">
                    {resourceSectionTitle}
                </p>
                <ul className="article-block__ltp-toc__secondary-list">
                    {resourceCards.map(
                        ({ id, title: cardTitle, description, icon, href }) => (
                            <li key={id}>
                                <a
                                    className="article-block__ltp-toc__secondary-card"
                                    href={href}
                                >
                                    <div className="article-block__ltp-toc__secondary-card-content">
                                        <span
                                            className="article-block__ltp-toc__secondary-card-icon"
                                            aria-hidden="true"
                                        >
                                            <FontAwesomeIcon icon={icon} />
                                        </span>
                                        <div className="article-block__ltp-toc__secondary-card-text">
                                            <span className="article-block__ltp-toc__secondary-card-title">
                                                {cardTitle}
                                            </span>
                                            <span className="article-block__ltp-toc__secondary-card-description">
                                                {description}
                                            </span>
                                        </div>
                                    </div>
                                    <FontAwesomeIcon
                                        icon={faArrowRight}
                                        className="article-block__ltp-toc__secondary-card-arrow"
                                        aria-hidden="true"
                                    />
                                </a>
                            </li>
                        )
                    )}
                </ul>
            </div>
        </nav>
    )
}

const buildSearchHrefForCard = (
    resultType: SearchResultType,
    tagName: string
) => {
    const searchState: SearchState = {
        query: "",
        filters: [createTopicFilter(tagName)],
        requireAllCountries: false,
        resultType,
    }
    const url = Url.fromURL(searchStateToUrl(searchState))
    return `${SEARCH_BASE_PATH}${url.queryStr}`
}
