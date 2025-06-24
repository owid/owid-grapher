import { getCanonicalPath } from "@ourworldindata/components"
import { OwidGdocType } from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import { Snippet } from "react-instantsearch"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { ArticleHit } from "./searchTypes.js"
import cx from "classnames"

export const SearchArticleHit = ({
    hit,
    variant = "flat",
}: {
    hit: ArticleHit
    variant?: "flat" | "stacked"
}) => {
    const isArticle = hit.type === OwidGdocType.Article

    const href = getCanonicalPath(hit.slug, hit.type)

    return (
        <SearchAsDraft name="Article Hit">
            <a
                href={href}
                className={cx("search-article-hit", {
                    "search-article-hit--stacked": variant === "stacked",
                    "search-article-hit--flat": variant === "flat",
                })}
            >
                <div className="search-article-hit__content">
                    {hit.thumbnailUrl && (
                        <div className="search-article-hit__image-container">
                            <img
                                src={hit.thumbnailUrl}
                                role="presentation"
                                className="search-article-hit__image"
                                alt=""
                            />
                        </div>
                    )}
                    <div className="search-article-hit__text">
                        <header className="search-article-hit__header">
                            {isArticle && hit.date && (
                                <DataInsightDateline
                                    className="search-article-hit__dateline"
                                    publishedAt={new Date(hit.date)}
                                    formatOptions={{
                                        year: "numeric",
                                        month: "long",
                                        day: "2-digit",
                                    }}
                                />
                            )}
                            <h3 className="search-article-hit__title">
                                {hit.title}
                            </h3>
                            {isArticle && (
                                <span className="search-article-hit__authors">
                                    {formatAuthors(hit.authors)}
                                </span>
                            )}
                        </header>
                        <Snippet
                            className="search-article-hit__excerpt"
                            attribute="content"
                            highlightedTagName="strong"
                            hit={hit}
                        />
                    </div>
                </div>
            </a>
        </SearchAsDraft>
    )
}
