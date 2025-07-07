import { getCanonicalPath } from "@ourworldindata/components"
import { OwidGdocType } from "@ourworldindata/types"
import { formatAuthors } from "@ourworldindata/utils"
import { Snippet } from "react-instantsearch"
import DataInsightDateline from "../gdocs/components/DataInsightDateline.js"
import { FlatArticleHit } from "./searchTypes.js"
import { SearchAsDraft } from "./SearchAsDraft.js"

export function SearchFlatArticleHit({ hit }: { hit: FlatArticleHit }) {
    const isArticle = hit.type === OwidGdocType.Article
    return (
        <SearchAsDraft name="Article Hit">
            <a
                className="search-flat-article-hit"
                href={getCanonicalPath(hit.slug, hit.type)}
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
                        <header className="search-flat-article-hit__header">
                            {isArticle && hit.date && (
                                <DataInsightDateline
                                    className="search-flat-article-hit__dateline"
                                    publishedAt={new Date(hit.date)}
                                    formatOptions={{
                                        year: "numeric",
                                        month: "long",
                                        day: "2-digit",
                                    }}
                                />
                            )}
                            <h3 className="search-flat-article-hit__title">
                                {hit.title}
                            </h3>
                            {isArticle && (
                                <span className="search-flat-article-hit__authors">
                                    {formatAuthors(hit.authors)}
                                </span>
                            )}
                        </header>
                        <Snippet
                            className="search-flat-article-hit__excerpt"
                            attribute="content"
                            highlightedTagName="strong"
                            hit={hit}
                        />
                    </div>
                </article>
            </a>
        </SearchAsDraft>
    )
}
