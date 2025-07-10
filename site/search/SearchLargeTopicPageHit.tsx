import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRightLong } from "@fortawesome/free-solid-svg-icons"
import { getCanonicalPath } from "@ourworldindata/components"
import { TopicPageHit } from "./searchTypes.js"

export const SearchLargeTopicPageHit = ({
    className,
    hit,
}: {
    className?: string
    hit: TopicPageHit
}) => (
    <a
        className={cx("search-large-topic-page-hit", className)}
        href={getCanonicalPath(hit.slug, hit.type)}
    >
        <div className="search-large-topic-page-hit__tag">Topic page</div>
        <h3 className="search-large-topic-page-hit__title">
            <span className="search-large-topic-page-hit__title-text">
                {hit.title}
            </span>{" "}
            <FontAwesomeIcon icon={faArrowRightLong} />
        </h3>
        <div className="search-large-topic-page-hit__excerpt">
            {hit.excerptLong && hit.excerptLong.length > 0 ? (
                hit.excerptLong.map((text, index) => (
                    <p
                        key={index}
                        className="search-large-topic-page-hit__excerpt-paragraph"
                    >
                        {text}
                    </p>
                ))
            ) : (
                <p className="search-large-topic-page-hit__excerpt-paragraph">
                    {hit.excerpt}
                </p>
            )}
        </div>
    </a>
)
