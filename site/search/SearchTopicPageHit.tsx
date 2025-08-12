import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRightLong } from "@fortawesome/free-solid-svg-icons"
import { getCanonicalPath } from "@ourworldindata/components"
import { TopicPageHit } from "./searchTypes.js"

function truncate(paragraphs: string[]) {
    const maxWords = 95
    let totalWords = 0
    const result = []

    for (const paragraph of paragraphs) {
        const paragraphWords = paragraph.split(/\s+/)
        if (totalWords + paragraphWords.length <= maxWords) {
            // We can include this entire paragraph
            result.push(paragraph)
            totalWords += paragraphWords.length
        } else {
            // This paragraph would exceed the limit, so truncate it
            const remainingWords = maxWords - totalWords
            if (remainingWords > 0) {
                const truncatedWords = paragraphWords.slice(0, remainingWords)
                result.push(truncatedWords.join(" ") + "...")
            }
            break
        }
    }

    return result
}

export const SearchTopicPageHit = ({
    className,
    hit,
    variant = "small",
}: {
    className?: string
    hit: TopicPageHit
    variant?: "small" | "large"
}) => (
    <a
        className={cx("search-topic-page-hit", className)}
        href={getCanonicalPath(hit.slug, hit.type)}
    >
        <div className="search-topic-page-hit__tag">Topic page</div>
        <h3 className="search-topic-page-hit__title">
            <span className="search-topic-page-hit__title-text">
                {hit.title}
            </span>{" "}
            <FontAwesomeIcon
                className="search-topic-page-hit__icon"
                icon={faArrowRightLong}
            />
        </h3>
        <div className="search-topic-page-hit__excerpt">
            {variant === "large" &&
            hit.excerptLong &&
            hit.excerptLong.length > 0 ? (
                truncate(hit.excerptLong).map((text, index) => (
                    <p
                        key={index}
                        className="search-topic-page-hit__excerpt-paragraph"
                    >
                        {text}
                    </p>
                ))
            ) : (
                <p className="search-topic-page-hit__excerpt-paragraph">
                    {hit.excerpt}
                </p>
            )}
        </div>
    </a>
)
