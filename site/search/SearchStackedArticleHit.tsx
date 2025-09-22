import { getCanonicalPath } from "@ourworldindata/components"
import { Snippet } from "react-instantsearch"
import { StackedArticleHit } from "./searchTypes.js"

export function SearchStackedArticleHit({
    hit,
    onClick,
}: {
    hit: StackedArticleHit
    onClick: VoidFunction
}) {
    return (
        <a
            className="search-stacked-article-hit"
            href={getCanonicalPath(hit.slug, hit.type)}
            onClick={onClick}
        >
            <article>
                {hit.thumbnailUrl && (
                    <img
                        src={hit.thumbnailUrl}
                        role="presentation"
                        className="search-stacked-article-hit__image"
                        alt=""
                    />
                )}
                <h3 className="search-stacked-article-hit__title">
                    {hit.title}
                </h3>
                <Snippet
                    classNames={{
                        root: "search-stacked-article-hit__excerpt",
                    }}
                    attribute="content"
                    highlightedTagName="strong"
                    hit={hit}
                />
            </article>
        </a>
    )
}
