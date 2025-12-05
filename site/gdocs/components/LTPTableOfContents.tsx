import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowDown,
    faArrowRight,
    faBook,
    faChartSimple,
} from "@fortawesome/free-solid-svg-icons"
import { TocHeadingWithTitleSupertitle } from "@ourworldindata/utils"
import { SearchResultType, SearchState } from "@ourworldindata/types"
import {
    createTopicFilter,
    SEARCH_BASE_PATH,
} from "../../search/searchUtils.js"
import { stateToSearchParams } from "../../search/searchState.js"
import cx from "classnames"

const DEFAULT_TITLE = "Sections"
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
        <nav className={cx(className, "ltp-toc")} aria-label={resolvedTitle}>
            <p className="ltp-toc__title col-start-2 span-cols-10 col-md-start-1 span-md-cols-12 span-sm-cols-12">
                {resolvedTitle}
            </p>
            <div className="ltp-toc__primary col-start-2 span-cols-7 col-md-start-1 span-md-cols-8 span-sm-cols-12">
                <ul className="ltp-toc__primary-list">
                    {toc.map(({ slug, title: headingTitle, text }) => {
                        const displayTitle = headingTitle || text
                        if (!slug || !displayTitle) return null
                        return (
                            <li key={slug} className="ltp-toc__primary-item">
                                <FontAwesomeIcon icon={faArrowDown} />
                                <a
                                    href={`#${slug}`}
                                    className="ltp-toc__primary-link"
                                    data-track-note="toc_link"
                                >
                                    {displayTitle}
                                </a>
                            </li>
                        )
                    })}
                </ul>
            </div>
            <div className="ltp-toc__secondary span-cols-3 span-md-cols-4 span-sm-cols-12">
                <p className="ltp-toc__secondary-title">
                    {resourceSectionTitle}
                </p>
                <ul className="ltp-toc__secondary-list">
                    {resourceCards.map(
                        ({ id, title: cardTitle, description, icon, href }) => (
                            <li key={id}>
                                <a
                                    className="ltp-toc__secondary-card"
                                    href={href}
                                >
                                    <div className="ltp-toc__secondary-card-content">
                                        <span
                                            className="ltp-toc__secondary-card-icon"
                                            aria-hidden="true"
                                        >
                                            <FontAwesomeIcon icon={icon} />
                                        </span>
                                        <div className="ltp-toc__secondary-card-text">
                                            <span className="ltp-toc__secondary-card-title">
                                                {cardTitle}
                                            </span>
                                            <span className="ltp-toc__secondary-card-description">
                                                {description}
                                            </span>
                                        </div>
                                    </div>
                                    <FontAwesomeIcon
                                        icon={faArrowRight}
                                        className="ltp-toc__secondary-card-arrow"
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
    const params = stateToSearchParams(searchState)
    return `${SEARCH_BASE_PATH}?${params.toString()}`
}
