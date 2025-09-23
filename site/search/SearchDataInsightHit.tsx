import cx from "classnames"
import { getCanonicalUrl } from "@ourworldindata/components"
import { formatDate } from "@ourworldindata/utils"
import { OwidGdocType } from "@ourworldindata/types"
import { DataInsightHit } from "./searchTypes.js"

export const SearchDataInsightHit = ({
    hit,
    className,
    onClick,
}: {
    hit: DataInsightHit
    className?: string
    onClick: VoidFunction
}) => {
    const href = getCanonicalUrl("", {
        slug: hit.slug,
        content: { type: OwidGdocType.DataInsight },
    })

    return (
        <a
            className={cx("search-data-insight-hit", className)}
            href={href}
            onClick={onClick}
        >
            <article>
                {hit.thumbnailUrl && (
                    <div className="search-data-insight-hit__image-container">
                        <img
                            className="search-data-insight-hit__image"
                            src={hit.thumbnailUrl}
                            alt=""
                        />
                    </div>
                )}
                <div className="search-data-insight-hit__date">
                    {formatDate(new Date(hit.date))}
                </div>
                <h3 className="search-data-insight-hit__title">{hit.title}</h3>
            </article>
        </a>
    )
}
