import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRightLong } from "@fortawesome/free-solid-svg-icons"
import { getCanonicalPath } from "@ourworldindata/components"
import { OwidGdocType, ProfileHit, TopicPageHit } from "@ourworldindata/types"

function truncate(paragraphs: string[]) {
    const maxWords = 35
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

function getTagLabel(type: TopicPageHit["type"] | ProfileHit["type"]): string {
    if (type === OwidGdocType.Profile) return "Country profile"
    return "Topic page"
}

export const SearchTopicPageHit = ({
    className,
    hit,
    variant = "small",
    flagCode,
    onClick,
}: {
    className?: string
    hit: TopicPageHit | ProfileHit
    variant?: "small" | "large"
    flagCode?: string
    onClick: VoidFunction
}) => (
    <a
        className={cx("search-topic-page-hit", className)}
        href={getCanonicalPath(hit.slug, hit.type)}
        onClick={onClick}
    >
        <div className="search-topic-page-hit__tag">
            {flagCode && (
                <img
                    className="search-topic-page-hit__flag"
                    aria-hidden={true}
                    height={12}
                    width={16}
                    src={`/images/flags/${flagCode}.svg`}
                    alt=""
                />
            )}
            {getTagLabel(hit.type)}
        </div>
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
            "excerptLong" in hit &&
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
