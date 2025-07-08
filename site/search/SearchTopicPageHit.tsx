import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRightLong } from "@fortawesome/free-solid-svg-icons"
import { getCanonicalPath } from "@ourworldindata/components"
import { TopicPageHit } from "./searchTypes.js"

export const SearchTopicPageHit = ({
    className,
    hit,
}: {
    className?: string
    hit: TopicPageHit
}) => (
    <a
        className={cx("search-topic-page-hit", className)}
        href={getCanonicalPath(hit.slug, hit.type)}
    >
        <h3 className="search-topic-page-hit__title">
            <span className="search-topic-page-hit__title-text">
                {hit.title}
            </span>{" "}
            <FontAwesomeIcon icon={faArrowRightLong} />
        </h3>
        <div className="search-topic-page-hit__excerpt">{hit.excerpt}</div>
    </a>
)
