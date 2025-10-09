import cx from "classnames"
import { Snippet } from "react-instantsearch"
import { getCanonicalPath } from "@ourworldindata/components"
import { OwidGdocType } from "@ourworldindata/types"
import { formatAuthors, formatDate } from "@ourworldindata/utils"
import { FlatArticleHit } from "./searchTypes.js"

export function SearchFlatArticleHit({
    className,
    hit,
    onClick,
}: {
    className?: string
    hit: FlatArticleHit
    onClick: VoidFunction
}) {
    const isArticle = hit.type === OwidGdocType.Article

    return (
        <a
            className={cx("search-flat-article-hit", className)}
            href={getCanonicalPath(hit.slug, hit.type)}
            onClick={onClick}
        >
            <article className="search-flat-article-hit__content">
                {hit.thumbnailUrl && (
                    <div className="search-flat-article-hit__image-container">
                        <img
                            src={hit.thumbnailUrl}
                            role="presentation"
                            className="search-flat-article-hit__image"
                            alt=""
                        />
                    </div>
                )}
                <div className="search-flat-article-hit__text">
                    <header>
                        {isArticle && hit.date && (
                            <div className="search-flat-article-hit__date">
                                {formatDate(new Date(hit.date))}
                            </div>
                        )}
                        <h3 className="search-flat-article-hit__title">
                            {hit.title}
                        </h3>
                    </header>
                    <div className="search-flat-article-hit__authors-and-excerpt">
                        {isArticle && (
                            <span className="search-flat-article-hit__authors">
                                by {formatAuthors(hit.authors)} —{" "}
                            </span>
                        )}
                        <Snippet
                            classNames={{
                                root: "search-flat-article-hit__excerpt",
                            }}
                            attribute="content"
                            highlightedTagName="strong"
                            hit={hit}
                        />
                    </div>
                </div>
            </article>
        </a>
    )
}
