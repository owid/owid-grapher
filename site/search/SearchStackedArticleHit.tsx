import { getCanonicalPath } from "@ourworldindata/components"
import { StackedArticleHit } from "@ourworldindata/types"

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
                {hit.content && (
                    <p className="search-stacked-article-hit__excerpt">
                        {hit.content.split(/\s+/).slice(0, 20).join(" ")}…
                    </p>
                )}
            </article>
        </a>
    )
}
